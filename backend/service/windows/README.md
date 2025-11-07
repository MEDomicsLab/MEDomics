Windows Service notes

Two options are provided:
1) Built-in Service Control Manager (sc.exe) with a direct binPath to medomics-server.exe start.
2) NSSM (Non-Sucking Service Manager) for more robust service wrapping and logging.

Usage with sc.exe (example):
- Run PowerShell as Administrator
- sc.exe create MEDomicsServer binPath= '"C:\\Program Files\\MEDomicsServer\\bin\\medomics-server.exe" start --workspace "C:\\MEDomicsWorkspace"' start= auto DisplayName= "MEDomics Server"
- sc.exe start MEDomicsServer

Using the provided script:
- .\\install-service.ps1 -InstallPath "C:\\Program Files\\MEDomicsServer" -Workspace "C:\\MEDomicsWorkspace"
- Add -UseNssm to rely on NSSM if installed.
