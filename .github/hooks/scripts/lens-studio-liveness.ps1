# Lens Studio MCP liveness gate for GitHub Copilot (Windows).
# Copilot port of ls-clad hooks/mcp-liveness-check.ps1 (Apache-2.0, Specs Inc.).
#
# preToolUse hook. Copilot hooks have no matcher, so this script filters on the
# event's toolName itself and returns "{}" (no decision) for non-Lens-Studio tools.
# Fails OPEN on anything uncertain. The MCP auth token is never read or logged.
# ASCII ONLY: Windows PowerShell 5.1 decodes .ps1 as Windows-1252 without a BOM.
$ErrorActionPreference = 'SilentlyContinue'

function Allow { '{}'; exit 0 }

$raw = [Console]::In.ReadToEnd()
$evt = $null
try { $evt = $raw | ConvertFrom-Json } catch {}
$tool = [string]$evt.toolName
if ($tool -notmatch '(?i)lens[-_]?studio') { Allow }

$url = $null
foreach ($dir in @($evt.cwd, (Get-Location).Path)) {
  if (-not $dir) { continue }
  foreach ($rel in @('.vscode/mcp.json', '.mcp.json')) {
    $f = Join-Path $dir $rel
    if (-not (Test-Path $f)) { continue }
    try {
      $j = Get-Content -Raw $f | ConvertFrom-Json
      $url = $j.servers.'lens-studio'.url
      if (-not $url) { $url = $j.mcpServers.'lens-studio'.url }
      if ($url) { break }
    } catch {}
  }
  if ($url) { break }
}
if (-not $url) { Allow }

try { $u = [Uri]$url; $h = $u.Host; $p = $u.Port } catch { Allow }
if (-not $p -or $p -le 0) { Allow }
if ($h -eq 'localhost') { $h = '127.0.0.1' }

$alive = $false
try {
  $c = New-Object Net.Sockets.TcpClient
  $iar = $c.BeginConnect($h, $p, $null, $null)
  $alive = $iar.AsyncWaitHandle.WaitOne(1000)
  if ($alive) { $c.EndConnect($iar) }
  $c.Close()
} catch { $alive = $false }
if ($alive) { Allow }

$reason = "Lens Studio MCP server is not reachable at ${h}:${p}. Lens Studio has crashed or been quit. Do NOT retry this or any other lens-studio tool; tell the user to relaunch Lens Studio with this project open, then retry."
@{ permissionDecision = 'deny'; permissionDecisionReason = $reason } | ConvertTo-Json -Compress
exit 0
