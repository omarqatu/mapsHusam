[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DeployPath,

    [Parameter(Mandatory = $true)]
    [string]$ServiceName,

    [string]$SmokeUrl = 'http://127.0.0.1:3000/'
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
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Host "Smoke test passed with HTTP $($response.StatusCode)."
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

$copyExclusions = @(
    '/XD', '.git', '.github', '.playwright', 'DB_Backups', 'GeoServerData',
    '/XF', '.gitignore', '.env', '.env.*'
)
$persistentExclusions = @('/XD', 'DB_Backups', 'GeoServerData')
$deploymentStarted = $false

try {
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

    if (Test-Path -LiteralPath $backup) {
        Remove-Item -LiteralPath $backup -Recurse -Force
    }
    if (Test-Path -LiteralPath $DeployPath) {
        Write-Host "Saving rollback copy at $backup"
        Invoke-Robocopy -Source $DeployPath -Destination $backup -ExtraArgs $persistentExclusions
    }

    Stop-Service -Name $ServiceName -Force
    $deploymentStarted = $true

    Write-Host "Deploying the staged release to $DeployPath"
    Invoke-Robocopy -Source $staging -Destination $DeployPath -ExtraArgs $copyExclusions
    Start-And-SmokeTest

    Remove-Item -LiteralPath $staging -Recurse -Force
    Write-Host "Deployment complete. Rollback copy retained at $backup"
}
catch {
    $failure = $_
    Write-Host "Deployment failed: $($failure.Exception.Message)" -ForegroundColor Red

    if ($deploymentStarted) {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $backup) {
            Write-Host 'Restoring the previous release...'
            Invoke-Robocopy -Source $backup -Destination $DeployPath -ExtraArgs $persistentExclusions
        }
        Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
    }

    throw $failure
}
finally {
    if (Test-Path -LiteralPath $staging) {
        Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
    }
}
