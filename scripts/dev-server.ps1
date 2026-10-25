# #TeriKolman66
param(
  [ValidateSet('Menu', 'Status')]
  [string]$Mode = 'Menu'
)

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$port = 1420
$url = "http://127.0.0.1:$port/"
$stateDirectory = Join-Path $env:LOCALAPPDATA 'Unfold'
$statePath = Join-Path $stateDirectory 'dev-server.json'

function Get-ListenerPid {
  foreach ($line in (netstat -ano -p TCP)) {
    if ($line -match '^\s*TCP\s+\S+:1420\s+\S+\s+LISTENING\s+(\d+)\s*$') {
      return [int]$Matches[1]
    }
  }
  return $null
}

function Get-ServerInfo {
  $listenerPid = Get-ListenerPid
  if (-not $listenerPid) { return $null }
  $process = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
  if (-not $process) { return $null }
  $commandLine = $null
  try {
    $commandLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$listenerPid" -ErrorAction Stop).CommandLine
  } catch { }

  $owned = $false
  if ($commandLine) {
    $owned = $commandLine.IndexOf((Join-Path $projectRoot 'node_modules'), [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
      $commandLine -match 'vite[\\/]+bin[\\/]+vite\.js'
  }
  if (-not $owned -and (Test-Path -LiteralPath $statePath)) {
    try {
      $saved = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
      $owned = [int]$saved.pid -eq $listenerPid -and
        [string]::Equals($saved.projectRoot, $projectRoot, [StringComparison]::OrdinalIgnoreCase) -and
        [string]::Equals($saved.startedAt, $process.StartTime.ToUniversalTime().ToString('o'), [StringComparison]::Ordinal)
    } catch { }
  }
  return [pscustomobject]@{ Pid = $listenerPid; Owned = $owned; CommandLine = $commandLine }
}

function Show-Status {
  $server = Get-ServerInfo
  if (-not $server) {
    Write-Host "Port $port is free. No local server is running there."
  } elseif ($server.Owned) {
    Write-Host "Unfold is running at $url (PID $($server.Pid))."
  } else {
    Write-Host "Port $port is in use by PID $($server.Pid). Its project could not be verified; it will not be stopped."
    if ($server.CommandLine) { Write-Host $server.CommandLine }
  }
}

if ($Mode -eq 'Status') { Show-Status; exit 0 }

Write-Host ''
Write-Host 'Unfold local server'
Show-Status
Write-Host ''
Write-Host '1  Run in this CMD window (Ctrl+C stops it)'
Write-Host '2  Keep running after this CMD window closes'
Write-Host '3  Stop the Unfold server on port 1420'
Write-Host '4  Exit without changes'
$choice = Read-Host 'Choose 1-4'

if ($choice -eq '4') { exit 0 }
if ($choice -eq '3') {
  $server = Get-ServerInfo
  if (-not $server) { Write-Host 'Nothing is running on port 1420.'; exit 0 }
  if (-not $server.Owned) { Write-Error 'This server was not verified as belonging to this Unfold folder. Nothing was stopped.'; exit 1 }
  $confirm = Read-Host "Stop Unfold server PID $($server.Pid)? (Y/N)"
  if ($confirm -notmatch '^[Yy]$') { Write-Host 'Left running.'; exit 0 }
  Stop-Process -Id $server.Pid -ErrorAction Stop
  if (Test-Path -LiteralPath $statePath) { Remove-Item -LiteralPath $statePath -Force }
  Write-Host 'Unfold server stopped.'
  exit 0
}
if ($choice -notin @('1', '2')) { Write-Error 'Choose 1, 2, 3, or 4.'; exit 1 }

$server = Get-ServerInfo
if ($server) {
  Write-Host "Port $port is already in use. No second server was started."
  Show-Status
  exit 1
}
$viteEntry = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) { Write-Error 'Node.js is required. Install Node.js, then run Start-Unfold.cmd again.'; exit 1 }
$node = $nodeCommand.Source
if (-not (Test-Path -LiteralPath $viteEntry)) {
  $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npmCommand) { Write-Error 'npm is required to install the project dependencies.'; exit 1 }
  $install = Read-Host 'Dependencies are missing. Install them now with npm ci? Internet is needed once. (Y/N)'
  if ($install -notmatch '^[Yy]$') { Write-Host 'Nothing was installed or started.'; exit 0 }
  Push-Location $projectRoot
  try { & $npmCommand.Source ci; $installExitCode = $LASTEXITCODE }
  finally { Pop-Location }
  if ($installExitCode -ne 0 -or -not (Test-Path -LiteralPath $viteEntry)) { Write-Error 'Dependency installation failed. Check the npm output above.'; exit 1 }
}

if ($choice -eq '1') {
  Write-Host "Running at $url. Press Ctrl+C in this window to stop."
  Push-Location $projectRoot
  try { & $node $viteEntry --host 127.0.0.1 --port $port --strictPort }
  finally { Pop-Location }
  exit $LASTEXITCODE
}

New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
$arguments = '"{0}" --host 127.0.0.1 --port {1} --strictPort' -f $viteEntry, $port
$process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDirectory 'dev-server.log') -RedirectStandardError (Join-Path $stateDirectory 'dev-server-errors.log')
@{ pid = $process.Id; projectRoot = $projectRoot; startedAt = $process.StartTime.ToUniversalTime().ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
Start-Sleep -Seconds 2
if ((Get-ListenerPid) -ne $process.Id) {
  Write-Error 'The background server did not start. Check the logs in AppData\Local\Unfold.'
  exit 1
}
Write-Host "Unfold is running at $url (PID $($process.Id))."
Write-Host 'You can close this CMD window. Run Start-Unfold.cmd again and choose 3 to stop it.'
