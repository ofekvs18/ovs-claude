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
  /TR "cmd /c node \"%PCSERVER_DIR%\dist\index.js\" >> \"%REPO%\pc-server-out.log\" 2>> \"%REPO%\pc-server-err.log\"" ^
  /SC ONLOGON ^
  /RU "%USERNAME%" ^
  /RL HIGHEST ^
  /DELAY 0000:30

REM ── Register bot ───────────────────────────────────────────────────
echo Registering Bot task...
schtasks /Create /F /TN "ClaudeAutonomous\Bot" ^
  /TR "cmd /c node \"%BOT_DIR%\dist\index.js\" >> \"%REPO%\bot-out.log\" 2>> \"%REPO%\bot-err.log\"" ^
  /SC ONLOGON ^
  /RU "%USERNAME%" ^
  /RL HIGHEST ^
  /DELAY 0001:00

REM ── Register session trigger (every 15 min) ───────────────────────
echo Registering SessionTrigger task...
schtasks /Create /F /TN "ClaudeAutonomous\SessionTrigger" ^
  /TR "C:\Windows\System32\curl.exe -s -X POST http://localhost:8080/session-start" ^
  /SC MINUTE ^
  /MO 15

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
