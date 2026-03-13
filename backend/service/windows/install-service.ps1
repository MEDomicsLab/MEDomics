Param(
  [string]$InstallPath = "C:\\Program Files\\MEDomicsServer",
  [string]$ServiceName = "MEDomicsServer",
  [string]$Workspace = "C:\\MEDomicsWorkspace",
  [switch]$UseNssm
)

Write-Host "Installing MEDomics Server service '$ServiceName' at $InstallPath" -ForegroundColor Cyan

if (-not (Test-Path $InstallPath)) {
  Write-Host "Install path does not exist: $InstallPath" -ForegroundColor Yellow
  exit 1
}

$exe = Join-Path $InstallPath 'bin/medomics-server.exe'
if (-not (Test-Path $exe)) {
  Write-Host "Executable not found: $exe" -ForegroundColor Red
  exit 1
}

if ($UseNssm) {
  if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
    Write-Host "nssm not found in PATH" -ForegroundColor Red; exit 1
  }
  nssm install $ServiceName $exe start --workspace $Workspace
  nssm set $ServiceName Start SERVICE_AUTO_START
  Write-Host "Service installed via NSSM. Use 'nssm edit $ServiceName' to adjust settings." -ForegroundColor Green
} else {
  $cmd = "$exe start --workspace $Workspace"
  sc.exe create $ServiceName binPath= "$cmd" start= auto DisplayName= "MEDomics Server"
  if ($LASTEXITCODE -ne 0) { Write-Host "sc.exe create failed" -ForegroundColor Red; exit 1 }
  Write-Host "Service created. Starting..." -ForegroundColor Cyan
  sc.exe start $ServiceName | Out-Null
  Write-Host "Service started." -ForegroundColor Green
}

Write-Host "Done." -ForegroundColor Green
