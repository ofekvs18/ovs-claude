@echo off
REM ─────────────────────────────────────────────────────────────────
REM  register-startup.bat
REM  Run once as Administrator to register all Task Scheduler jobs.
REM
REM  Prerequisites:
REM    1. Node.js installed
REM    2. Claude Code installed globally  (npm i -g @anthropic-ai/claude-code)
REM    3. Logged in to Claude Code  (claude login)
REM    4. bot/.env created with TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
REM    5. Both packages built  (npm run build in pc-server/ and bot/)
REM    6. Run this script as Administrator
REM ─────────────────────────────────────────────────────────────────

SET REPO=C:\Users\ofek\Downloads\gitRepos\ClaudeToDoAutomation
SET PCSERVER_DIR=%REPO%\pc-server
SET BOT_DIR=%REPO%\bot

REM ── Register pc-server ─────────────────────────────────────────────
echo Registering PCServer task...
schtasks /Create /F /TN "ClaudeAutonomous\PCServer" ^
  /TR "node \"%PCSERVER_DIR%\dist\index.js\"" ^
  /SC ONLOGON ^
  /RU "%USERNAME%" ^
  /RL HIGHEST ^
  /DELAY 0000:30

REM ── Register bot ───────────────────────────────────────────────────
echo Registering Bot task...
schtasks /Create /F /TN "ClaudeAutonomous\Bot" ^
  /TR "node \"%BOT_DIR%\dist\index.js\"" ^
  /SC ONLOGON ^
  /RU "%USERNAME%" ^
  /RL HIGHEST ^
  /DELAY 0001:00

REM ── Register hourly session trigger ────────────────────────────────
echo Registering SessionTrigger task...
schtasks /Create /F /TN "ClaudeAutonomous\SessionTrigger" ^
  /TR "curl -s -X POST http://localhost:8080/session-start" ^
  /SC HOURLY ^
  /MO 1 ^
  /RU "%USERNAME%"

echo.
echo Done! Three tasks registered under ClaudeAutonomous\
echo   PCServer        — starts 30s after login  (port 3333)
echo   Bot             — starts 60s after login  (port 8080)
echo   SessionTrigger  — fires at the top of every hour
echo.
echo To start tasks immediately without rebooting:
echo   schtasks /Run /TN "ClaudeAutonomous\PCServer"
echo   schtasks /Run /TN "ClaudeAutonomous\Bot"
echo.
pause
