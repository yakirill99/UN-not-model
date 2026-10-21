<#
.SYNOPSIS
  Forward localhost ports on Windows to the WSL2 (NAT mode) VM.

  Needed when WSL's own localhostForwarding is broken by an endpoint agent that
  hooks loopback traffic (Dr.Web, some corporate AV/VPN). WSL is still reachable by
  its 172.x address, so we proxy 127.0.0.1/::1 to it with netsh portproxy.

  Run from an elevated PowerShell after every `wsl --shutdown` (the 172.x address changes):

      .\scripts\wsl-portproxy.ps1            # 5173 (vite) and 8000 (api)
      .\scripts\wsl-portproxy.ps1 -Ports 5173
      .\scripts\wsl-portproxy.ps1 -Remove    # drop the rules

  Check:   netsh interface portproxy show all
#>
param(
  [int[]] $Ports = @(5173, 8000),
  [switch] $Remove
)

$ErrorActionPreference = 'Stop'
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script from an elevated (Administrator) PowerShell.'
}

foreach ($port in $Ports) {
  netsh interface portproxy delete v4tov4 listenaddress=127.0.0.1 listenport=$port | Out-Null
  netsh interface portproxy delete v6tov4 listenaddress=::1      listenport=$port | Out-Null
}
if ($Remove) { netsh interface portproxy show all; return }

$wslIp = (wsl.exe hostname -I).Trim().Split(' ')[0]
if (-not $wslIp) { throw 'WSL is not running or has no IPv4 address (wsl hostname -I).' }

foreach ($port in $Ports) {
  netsh interface portproxy add v4tov4 listenaddress=127.0.0.1 listenport=$port connectaddress=$wslIp connectport=$port | Out-Null
  netsh interface portproxy add v6tov4 listenaddress=::1      listenport=$port connectaddress=$wslIp connectport=$port | Out-Null
  Write-Host "localhost:$port -> ${wslIp}:$port"
}
netsh interface portproxy show all
