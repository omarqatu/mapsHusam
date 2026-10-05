[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DeployPath,

    [Parameter(Mandatory = $true)]
    [string]$ServiceName,

    [string]$SmokeUrl = 'http://127.0.0.1:3000/',

    [string]$HealthUrl = 'http://127.0.0.1:3000/readyz',

    [string]$BackupRoot = (Join-Path $env:ProgramData 'mapsHusam\backups'),

    [switch]$PreflightOnly
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$workspace = $env:GITHUB_WORKSPACE
if (-not $workspace) {
    throw 'GITHUB_WORKSPACE is not set.'
}

$parent = Split-Path -Parent $DeployPath
$leaf = Split-Path -Leaf $DeployPath
# Both kept between runs: robocopy /MIR then copies only what changed (a fresh folder would make every file look new).
$staging = Join-Path $parent "$leaf.__next"
$backup = Join-Path $parent "$leaf.__previous"
$serviceStopped = $false

# Read the machine/NSSM environment without logging its values. Runner variables are not necessarily service variables.
$serviceEnvironment = @{}
foreach ($entry in [Environment]::GetEnvironmentVariables('Machine').GetEnumerator()) {
    $serviceEnvironment[$entry.Key] = $entry.Value
}
$parametersPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName\Parameters"
if (Test-Path $parametersPath) {
    $parameters = Get-ItemProperty -LiteralPath $parametersPath
    if ($parameters.PSObject.Properties['AppDirectory'] -and $parameters.AppDirectory -and
        [IO.Path]::GetFullPath($parameters.AppDirectory).TrimEnd('\') -ne [IO.Path]::GetFullPath($DeployPath).TrimEnd('\')) {
        throw 'NSSM AppDirectory must match DeployPath so backup and application read the same .env.'
    }
    foreach ($property in @('AppEnvironment', 'AppEnvironmentExtra')) {
        if ($parameters.PSObject.Properties[$property]) {
            foreach ($entry in $parameters.$property) {
                $parts = $entry -split '=', 2
                if ($parts.Count -eq 2) { $serviceEnvironment[$parts[0]] = $parts[1] }
            }
        }
    }
}
$serviceEnvironmentJson = ConvertTo-Json -InputObject $serviceEnvironment -Compress

function Invoke-ProductionBackup {
    param([string]$Mode, [string]$Folder = '')
    $previousEncoding = $OutputEncoding
    try {
        $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
        $output = $serviceEnvironmentJson | & node (Join-Path $workspace 'tools\backup-production.mjs') $Mode $DeployPath $BackupRoot $env:GITHUB_SHA $Folder
    }
    finally { $OutputEncoding = $previousEncoding }
    if ($LASTEXITCODE -ne 0) { throw "Production backup $Mode failed; deployment is blocked." }
    return $output
}

# Where the time goes: each phase is timed and printed, and the run ends with a summary. A phase runs in this
# function's scope: what it must hand on is set as $script:… .
$timings = New-Object System.Collections.Generic.List[string]
function Measure-Phase {
    param([Parameter(Mandatory = $true)][string]$Name, [Parameter(Mandatory = $true)][scriptblock]$Block)
    $watch = [Diagnostics.Stopwatch]::StartNew()
    try { . $Block }
    finally {
        $line = '{0,-34} {1,7:N1}s' -f $Name, $watch.Elapsed.TotalSeconds
        $timings.Add($line)
        Write-Host "[time] $line"
    }
}
$downtime = New-Object Diagnostics.Stopwatch
function Write-Timings {
    Write-Host '---- deploy timings ----'
    $timings | ForEach-Object { Write-Host $_ }
    Write-Host ('Service was down for {0:N1}s' -f $downtime.Elapsed.TotalSeconds)
}

function Invoke-Robocopy {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination,
        [string[]]$ExtraArgs = @()
    )

    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    & robocopy $Source $Destination /MIR /R:2 /W:2 /NFL /NDL /NJH /NJS /NP @ExtraArgs
    if ($LASTEXITCODE -gt 7) {
        throw "robocopy failed with exit code $LASTEXITCODE ($Source -> $Destination)"
    }
    # Robocopy uses 1-7 for successful copies. GitHub's PowerShell wrapper otherwise treats them as job failures.
    $global:LASTEXITCODE = 0
}

function Start-And-SmokeTest {
    Start-Service -Name $ServiceName
    $lastError = $null
    for ($attempt = 1; $attempt -le 20; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $SmokeUrl -UseBasicParsing -TimeoutSec 5
            $health = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
            $healthBody = $health.Content | ConvertFrom-Json
            if ($response.StatusCode -eq 200 -and $health.StatusCode -eq 200 -and $healthBody.ok -eq $true) {
                Write-Host 'Smoke test passed: app and both databases are available.'
                return
            }
            $lastError = "HTTP $($response.StatusCode)"
        }
        catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 2
    }
    throw "Smoke test failed after 20 attempts: $lastError"
}

# `uploads` holds the pictures people upload (server/routes/my-listings.js): data, not code. /MIR must never purge it,
# and the rollback copy must not drag an old set of pictures back over the live one.
$copyExclusions = @(
    '/XD', '.git', '.github', '.playwright', '.claude', 'notes', 'dev', 'DB_Backups', 'GeoServerData', 'uploads', 'pic',
    '/XF', '.gitignore', '.env', '.env.*', 'env'
)
# A rollback restores code only: retain the current credentials and user files.
$persistentExclusions = @('/XD', 'DB_Backups', 'GeoServerData', 'uploads', 'pic', '/XF', '.env', '.env.*', 'env')
# The web app's own dependencies only build web\dist; the server never loads them. Kept out of the release (tens of
# thousands of files every copy would otherwise walk).
$stagingExclusions = $copyExclusions + @('/XD', (Join-Path $workspace 'web\node_modules'))

function Copy-SnapshotPictures {
    param([Parameter(Mandatory = $true)]$Snapshot)
    foreach ($pair in @(@($Snapshot.uploads, 'uploads'), @($Snapshot.pic, 'pic'))) {
        if (Test-Path -LiteralPath $pair[0]) {
            Invoke-Robocopy -Source $pair[0] -Destination (Join-Path $Snapshot.folder $pair[1])
        }
    }
}
$deploymentStarted = $false

try {
    # Private snapshots live outside IIS and the release folders. No snapshot is automatically deleted.
    New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
    $runnerIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $BackupRoot /inheritance:r /grant:r "${runnerIdentity}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict backup directory permissions.' }
    Invoke-ProductionBackup -Mode 'preflight'
    if ($PreflightOnly) {
        Write-Host 'Production backup configuration and client tools passed preflight.'
        return
    }

    # Everything that needs no stopped site happens first: staging, the rollback copy, the first picture copy.
    Measure-Phase 'stage release' {
        Write-Host "Preparing staged release at $staging"
        Invoke-Robocopy -Source $workspace -Destination $staging -ExtraArgs $stagingExclusions
    }

    if (-not (Test-Path -LiteralPath (Join-Path $staging 'server.js'))) {
        throw 'Staged release is missing server.js.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $staging 'server\app.js'))) {
        throw 'Staged release is missing the server\ modules.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $staging 'shared\service-types.json'))) {
        throw 'Staged release is missing shared\service-types.json.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $staging 'web\dist\index.html'))) {
        throw 'Staged release is missing web\dist\index.html.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $staging 'node_modules'))) {
        throw 'Staged release is missing server node_modules.'
    }

    # The running release does not change while it runs, so its rollback copy is taken before the stop.
    if (Test-Path -LiteralPath $DeployPath) {
        Measure-Phase 'rollback copy' {
            Write-Host "Saving rollback copy at $backup"
            Invoke-Robocopy -Source $DeployPath -Destination $backup -ExtraArgs $persistentExclusions
        }
    }

    # Older releases carried web\node_modules; the running server never reads it, so it goes before the stop.
    $deployedWebModules = Join-Path $DeployPath 'web\node_modules'
    if (Test-Path -LiteralPath $deployedWebModules) {
        Measure-Phase 'remove old web\node_modules' { Remove-Item -LiteralPath $deployedWebModules -Recurse -Force }
    }

    # The snapshot's pictures: a full copy now, while the site runs; after the stop only what changed meanwhile.
    Measure-Phase 'snapshot pictures (site up)' {
        $script:snapshot = (Invoke-ProductionBackup -Mode 'prepare' | Select-Object -Last 1) | ConvertFrom-Json
        Copy-SnapshotPictures $snapshot
    }

    Stop-Service -Name $ServiceName -Force
    $serviceStopped = $true
    $downtime.Start()
    # Stop application writes before taking a consistent pair of database + picture snapshots.
    Measure-Phase 'snapshot pictures (changes only)' { Copy-SnapshotPictures $snapshot }
    Measure-Phase 'snapshot databases' {
        Invoke-ProductionBackup -Mode 'backup' -Folder $snapshot.folder | ForEach-Object { Write-Host $_ }
    }

    $deploymentStarted = $true

    Measure-Phase 'copy release to site' {
        Write-Host "Deploying the staged release to $DeployPath"
        Invoke-Robocopy -Source $staging -Destination $DeployPath -ExtraArgs $copyExclusions
    }
    Measure-Phase 'start + smoke test' { Start-And-SmokeTest }
    $serviceStopped = $false
    $downtime.Stop()

    Write-Host "Deployment complete. Rollback copy retained at $backup"
    Write-Timings
}
catch {
    $failure = $_
    Write-Host "Deployment failed: $($failure.Exception.Message)" -ForegroundColor Red

    if ($deploymentStarted) {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        $serviceStopped = $true
        if (Test-Path -LiteralPath $backup) {
            Write-Host 'Restoring the previous release...'
            Invoke-Robocopy -Source $backup -Destination $DeployPath -ExtraArgs $persistentExclusions
        }
    }

    if ($serviceStopped) { Start-Service -Name $ServiceName }
    $downtime.Stop()
    Write-Timings

    throw $failure
}
finally {
    # Releases staged by older versions of this script (one folder per run) are not reused.
    Get-ChildItem -LiteralPath $parent -Directory -Filter "$leaf.__next_*" -ErrorAction SilentlyContinue |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
