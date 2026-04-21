@echo off
REM ─────────────────────────────────────────────────────────────────
REM  start-pc-server.bat
REM  Run this once to register the Task Scheduler jobs that
REM  auto-start the pc-server and Cloudflare tunnel on Windows login.
REM
REM  Prerequisites:
REM    1. Node.js installed  (node -v should work)
REM    2. Claude Code installed globally  (npm i -g @anthropic-ai/claude-code)
REM    3. cloudflared.exe downloaded to C:\tools\cloudflared.exe
REM       https://github.com/cloudflare/cloudflared/releases/latest
REM    4. Run this script once as Administrator
REM ─────────────────────────────────────────────────────────────────

SET PCSERVER_DIR=C:\Users\ofek\Downloads\gitRepos\ClaudeToDoAutomation\pc-server
SET CLOUDFLARED=C:\tools\cloudflared.exe
SET TUNNEL_TOKEN=REPLACE_WITH_YOUR_CLOUDFLARE_TUNNEL_TOKEN

REM ── Build pc-server ────────────────────────────────────────────────
echo Building pc-server...
cd /d %PCSERVER_DIR%
call npm install
call npm run build

REM ── Register pc-server as a scheduled task ─────────────────────────
echo Registering pc-server task...
schtasks /Create /F /TN "ClaudeAutonomous\PCServer" ^
  /TR "node %PCSERVER_DIR%\dist\index.js" ^
  /SC ONLOGON ^
  /RU "%USERNAME%" ^
  /RL HIGHEST ^
  /DELAY 0000:30

REM ── Register Cloudflare tunnel as a scheduled task ─────────────────
echo Registering Cloudflare tunnel task...
schtasks /Create /F /TN "ClaudeAutonomous\CloudflaredTunnel" ^
  /TR "\"%CLOUDFLARED%\" tunnel --no-autoupdate run --token %TUNNEL_TOKEN%" ^
  /SC ONLOGON ^
  /RU "%USERNAME%" ^
  /RL HIGHEST ^
  /DELAY 0001:00

echo.
echo Done! Two tasks registered under ClaudeAutonomous\
echo   - PCServer       starts 30s after login
echo   - CloudflaredTunnel  starts 60s after login
echo.
echo To start them right now without rebooting:
echo   schtasks /Run /TN "ClaudeAutonomous\CloudflaredTunnel"
echo   schtasks /Run /TN "ClaudeAutonomous\PCServer"
echo.
pause
