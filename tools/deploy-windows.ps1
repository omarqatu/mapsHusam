[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DeployPath,

    [Parameter(Mandatory = $true)]
    [string]$ServiceName,

    [string]$SmokeUrl = 'http://127.0.0.1:3000/',

    [string]$HealthUrl = 'http://127.0.0.1:3000/readyz',

    [string]$BackupRoot = (Join-Path $env:ProgramData 'mapsHusam\backups')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$workspace = $env:GITHUB_WORKSPACE
if (-not $workspace) {
    throw 'GITHUB_WORKSPACE is not set.'
}

$parent = Split-Path -Parent $DeployPath
$leaf = Split-Path -Leaf $DeployPath
$runId = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() }
$staging = Join-Path $parent "$leaf.__next_$runId"
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
    param([string]$Mode)
    $previousEncoding = $OutputEncoding
    try {
        $OutputEncoding = New-Object System.Text.UTF8Encoding($false)
        $serviceEnvironmentJson | & node (Join-Path $workspace 'tools\backup-production.mjs') $Mode $DeployPath $BackupRoot $env:GITHUB_SHA
    }
    finally { $OutputEncoding = $previousEncoding }
    if ($LASTEXITCODE -ne 0) { throw "Production backup $Mode failed; deployment is blocked." }
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
    '/XD', '.git', '.github', '.playwright', '.claude', 'notes', 'dev', 'DB_Backups', 'GeoServerData', 'uploads',
    '/XF', '.gitignore', '.env', '.env.*', 'env'
)
# A rollback restores code only: retain the current credentials and user files.
$persistentExclusions = @('/XD', 'DB_Backups', 'GeoServerData', 'uploads', '/XF', '.env', '.env.*', 'env')
$deploymentStarted = $false

try {
    # Private snapshots live outside IIS and the release folders. No snapshot is automatically deleted.
    New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
    $runnerIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $BackupRoot /inheritance:r /grant:r "${runnerIdentity}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict backup directory permissions.' }
    Invoke-ProductionBackup -Mode 'preflight'

    if (Test-Path -LiteralPath $staging) {
        Remove-Item -LiteralPath $staging -Recurse -Force
    }

    Write-Host "Preparing staged release at $staging"
    Invoke-Robocopy -Source $workspace -Destination $staging -ExtraArgs $copyExclusions

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

    Stop-Service -Name $ServiceName -Force
    $serviceStopped = $true
    # Stop application writes before taking a consistent pair of database + picture snapshots.
    Invoke-ProductionBackup -Mode 'backup'

    if (Test-Path -LiteralPath $backup) {
        Remove-Item -LiteralPath $backup -Recurse -Force
    }
    if (Test-Path -LiteralPath $DeployPath) {
        Write-Host "Saving rollback copy at $backup"
        Invoke-Robocopy -Source $DeployPath -Destination $backup -ExtraArgs $persistentExclusions
    }

    $deploymentStarted = $true

    Write-Host "Deploying the staged release to $DeployPath"
    Invoke-Robocopy -Source $staging -Destination $DeployPath -ExtraArgs $copyExclusions
    Start-And-SmokeTest
    $serviceStopped = $false

    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Deployment complete. Rollback copy retained at $backup"
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

    throw $failure
}
finally {
    if (Test-Path -LiteralPath $staging) {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    }
}
