# One-time clean-up of the old PM2 copy of the app on the production server.
#
# Before the NSSM service "mapsHusam" existed, the app ran under PM2 as Administrator. That PM2 is still installed
# and keeps restarting its old copy; whenever it grabs port 3000 first, the site serves old code. Every deploy stops
# the old process, but PM2 brings it back. This removes PM2's apps, its saved list and its start-at-boot entries, so
# only the service runs the app.
#
# Run in PowerShell as Administrator (the account PM2 ran under), from the site folder:
#   powershell -ExecutionPolicy Bypass -File tools\remove-old-pm2.ps1            # report only, changes nothing
#   powershell -ExecutionPolicy Bypass -File tools\remove-old-pm2.ps1 -Apply     # do it
# Everything removed is moved aside or exported to $BackupDir first, so it can be put back.

[CmdletBinding()]
param(
    [switch]$Apply,
    [string]$ServiceName = 'mapsHusam',
    [string]$SitePath = 'C:\inetpub\wwwroot\psm\mapsHusam',
    [int]$Port = 3000,
    [string]$BackupDir = (Join-Path $env:ProgramData ('mapsHusam\pm2-removed-' + (Get-Date -Format 'yyyyMMdd-HHmmss')))
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Say([string]$Text, [string]$Color = 'Gray') { Write-Host $Text -ForegroundColor $Color }
function Ensure-BackupDir { if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir | Out-Null } }
function Get-Prop($Object, [string]$Name) { if ($Object.PSObject.Properties[$Name]) { $Object.$Name } else { '' } }
# True when the process is the service's process or was started (directly or through cmd/npm) by it.
function Test-UnderService([int]$ProcessId, [int]$ServicePid) {
    for ($i = 0; $i -lt 5 -and $ProcessId; $i++) {
        if ($ProcessId -eq $ServicePid) { return $true }
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId"
        if (-not $proc) { return $false }
        $ProcessId = $proc.ParentProcessId
    }
    return $false
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'Run this from an elevated PowerShell (Run as Administrator).' }

Say "Mode: $(if ($Apply) { 'APPLY' } else { 'report only (add -Apply to change anything)' })" 'Cyan'

# --- 1. What runs now -------------------------------------------------------------------------------------------
$service = Get-CimInstance Win32_Service -Filter "Name='$ServiceName'"
if (-not $service) { throw "Service '$ServiceName' not found." }
Say "Service $ServiceName : $($service.State), start mode $($service.StartMode), PID $($service.ProcessId)"

$nodes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'")
foreach ($p in $nodes) {
    $owner = if (Test-UnderService $p.ProcessId $service.ProcessId) { 'service' } elseif ("$($p.CommandLine)" -match '\\pm2\\') { 'PM2' } else { 'other' }
    Say ("  node PID {0,-6} [{1}] started {2}: {3}" -f $p.ProcessId, $owner, $p.CreationDate, $p.CommandLine)
}
$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $who = if (Test-UnderService $listener.OwningProcess $service.ProcessId) { 'the service (good)' } else { 'NOT the service' }
    Say "Port $Port is held by PID $($listener.OwningProcess): $who" $(if ($who -like 'the service*') { 'Green' } else { 'Yellow' })
} else { Say "Nobody listens on port $Port." 'Yellow' }

# --- 2. PM2's saved apps (where the old copy lives) -------------------------------------------------------------
$pm2Home = if ($env:PM2_HOME) { $env:PM2_HOME } else { Join-Path $env:USERPROFILE '.pm2' }
$dump = Join-Path $pm2Home 'dump.pm2'
$oldFolders = @()
if (Test-Path $dump) {
    # Read with regexes, not ConvertFrom-Json: PM2 saves the environment, which holds keys differing only in case
    # (username / USERNAME) that Windows PowerShell 5.1 refuses to parse.
    $text = Get-Content $dump -Raw
    $jsonString = '"((?:[^"\\]|\\.)*)"'
    foreach ($m in [regex]::Matches($text, '"pm_exec_path"\s*:\s*' + $jsonString)) {
        Say "PM2 saved app script: $([regex]::Unescape($m.Groups[1].Value))" 'Yellow'
    }
    foreach ($m in [regex]::Matches($text, '"pm_cwd"\s*:\s*' + $jsonString)) {
        $cwd = [regex]::Unescape($m.Groups[1].Value)
        Say "PM2 saved app folder: $cwd" 'Yellow'
        if ($cwd) { $oldFolders += $cwd }
    }
} else { Say "No PM2 saved list at $dump." }

# --- 3. Pictures and videos that exist only in the old copy -----------------------------------------------------
# Copied into the live uploads folder only when missing there; nothing in the live folder is overwritten.
$liveUploads = Join-Path $SitePath 'uploads'
foreach ($folder in ($oldFolders | Sort-Object -Unique)) {
    $oldUploads = (Join-Path $folder 'uploads').TrimEnd('\')
    if (-not (Test-Path $oldUploads) -or $oldUploads -eq $liveUploads) { continue }
    $missing = @(Get-ChildItem $oldUploads -Recurse -File | Where-Object {
        -not (Test-Path (Join-Path $liveUploads $_.FullName.Substring($oldUploads.Length).TrimStart('\')))
    })
    Say "$oldUploads : $($missing.Count) file(s) missing from the live site" $(if ($missing.Count) { 'Yellow' } else { 'Gray' })
    foreach ($f in $missing) {
        $relative = $f.FullName.Substring($oldUploads.Length).TrimStart('\')
        Say "  $relative"
        if ($Apply) {
            $target = Join-Path $liveUploads $relative
            New-Item -ItemType Directory -Path (Split-Path $target) -Force | Out-Null
            Copy-Item $f.FullName $target
        }
    }
}

# --- 4. Start-at-boot entries that would bring PM2 back --------------------------------------------------------
$tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object {
    # COM-handler actions have no Execute / Arguments.
    ($_.Actions | ForEach-Object { "$(Get-Prop $_ 'Execute') $(Get-Prop $_ 'Arguments')" }) -match 'pm2'
})
$pm2Services = @(Get-CimInstance Win32_Service | Where-Object { $_.Name -ne $ServiceName -and ($_.PathName -match 'pm2' -or $_.Name -match 'pm2') })
$runKeys = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'
$runValues = @(foreach ($key in $runKeys) {
    if (-not (Test-Path $key)) { continue }
    $props = Get-ItemProperty $key
    foreach ($p in $props.PSObject.Properties) {
        if ($p.Name -notlike 'PS*' -and "$($p.Value)" -match 'pm2') { [pscustomobject]@{ Key = $key; Name = $p.Name; Value = $p.Value } }
    }
})
$startupFolders = @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup'))
$shortcuts = @($startupFolders | Where-Object { $_ -and (Test-Path $_) } | ForEach-Object { Get-ChildItem $_ -File } |
    Where-Object { $_.Name -match 'pm2' -or (Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue) -match 'pm2' })

foreach ($t in $tasks) { Say "Scheduled task: $($t.TaskPath)$($t.TaskName)" 'Yellow' }
foreach ($s in $pm2Services) { Say "Service: $($s.Name) ($($s.StartMode)) $($s.PathName)" 'Yellow' }
foreach ($v in $runValues) { Say "Run entry: $($v.Key)\$($v.Name) = $($v.Value)" 'Yellow' }
foreach ($l in $shortcuts) { Say "Startup item: $($l.FullName)" 'Yellow' }
if (-not ($tasks.Count + $pm2Services.Count + $runValues.Count + $shortcuts.Count)) { Say 'No PM2 start-at-boot entries found.' }

if (-not $Apply) {
    Say 'Nothing changed. Run again with -Apply to remove the above.' 'Cyan'
    return
}

# --- 5. Remove PM2 and everything that starts it -----------------------------------------------------------------
Ensure-BackupDir
$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if ($pm2) {
    & pm2 delete all 2>&1 | Out-Null
    & pm2 kill 2>&1 | Out-Null
    Say 'pm2 delete all + pm2 kill done.'
}
if (Test-Path $dump) { Move-Item $dump (Join-Path $BackupDir 'dump.pm2'); Say "Saved list moved to $BackupDir." }
# Whatever PM2 left running (its daemon or app processes), stopped by hand.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '\\pm2\\' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; Say "Stopped PM2 process $($_.ProcessId)." }

foreach ($t in $tasks) {
    Export-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath | Set-Content (Join-Path $BackupDir "task-$($t.TaskName).xml")
    Disable-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath | Out-Null
    Say "Disabled scheduled task $($t.TaskName)."
}
foreach ($s in $pm2Services) {
    Stop-Service -Name $s.Name -Force -ErrorAction SilentlyContinue
    Set-Service -Name $s.Name -StartupType Disabled
    Say "Stopped and disabled service $($s.Name) (was $($s.StartMode))."
}
foreach ($v in $runValues) {
    "$($v.Key)`t$($v.Name)`t$($v.Value)" | Add-Content (Join-Path $BackupDir 'run-entries.txt')
    Remove-ItemProperty -Path $v.Key -Name $v.Name
    Say "Removed run entry $($v.Name)."
}
foreach ($l in $shortcuts) { Move-Item $l.FullName $BackupDir; Say "Moved startup item $($l.Name) aside." }

# --- 6. Only the service runs the app ---------------------------------------------------------------------------
Restart-Service -Name $ServiceName -Force
$deadline = (Get-Date).AddSeconds(60)
do {
    Start-Sleep -Seconds 2
    $service = Get-CimInstance Win32_Service -Filter "Name='$ServiceName'"
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    $ok = $listener -and (Test-UnderService $listener.OwningProcess $service.ProcessId)
} until ($ok -or (Get-Date) -gt $deadline)

if ($ok) {
    Say "Done: port $Port is held by the service (PID $($listener.OwningProcess)). Removed items are in $BackupDir." 'Green'
} else {
    Say "Port $Port is still not held by the service. Paste this output to the developer." 'Red'
    exit 1
}
