#!/usr/bin/env bash
# Lens Studio MCP liveness gate for GitHub Copilot (VS Code / Copilot app / Copilot CLI).
# Copilot port of ls-clad hooks/mcp-liveness-check.sh (Apache-2.0, Specs Inc.).
#
# preToolUse hook. Copilot hooks have no matcher, so this script filters on the
# event's toolName itself and returns "{}" (no decision) for non-Lens-Studio tools.
#   Lens Studio reachable -> "{}" (normal permission flow continues)
#   Lens Studio dead      -> permissionDecision "deny"
# Fails OPEN on anything uncertain. The MCP auth token is never read or logged.
# ASCII ONLY.

allow() { printf '{}'; exit 0; }

case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) allow ;; esac
case "$(uname -r 2>/dev/null)" in *icrosoft*|*WSL*) allow ;; esac
[ -n "$WSL_DISTRO_NAME" ] && allow

payload="$(cat 2>/dev/null)"
tool="$(printf '%s' "$payload" | sed -n 's/.*"toolName"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
case "$tool" in
  *lens-studio*|*lens_studio*|*Lens-Studio*|*LensStudio*) ;;
  *) allow ;;
esac

stdin_cwd="$(printf '%s' "$payload" | sed -n 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"

url=""
for dir in "$stdin_cwd" "$PWD"; do
  [ -n "$dir" ] || continue
  for f in "$dir/.vscode/mcp.json" "$dir/.mcp.json"; do
    [ -f "$f" ] || continue
    url="$(tr -d '\n\r' < "$f" | sed -n 's/.*"lens-studio"[[:space:]]*:[[:space:]]*{[^}]*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    [ -n "$url" ] && break 2
  done
done
[ -n "$url" ] || allow

hostport="${url#*://}"
hostport="${hostport%%/*}"
host="${hostport%%:*}"
port="${hostport##*:}"
{ [ -n "$port" ] && [ "$port" != "$hostport" ]; } || allow
case "$port" in *[!0-9]*) allow ;; esac
[ "$host" = "localhost" ] && host="127.0.0.1"

if (exec 3<>"/dev/tcp/$host/$port") 2>/dev/null; then
  allow
fi

printf '%s' "{\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Lens Studio MCP server is not reachable at ${host}:${port}. Lens Studio has crashed or been quit. Do NOT retry this or any other lens-studio tool; tell the user to relaunch Lens Studio with this project open, then retry.\"}"
exit 0
