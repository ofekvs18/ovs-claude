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
powershell -Command "$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '\""%REPO%\scripts\launch-pcserver.vbs\""' -WorkingDirectory '%PCSERVER_DIR%'; $t = New-ScheduledTaskTrigger -AtLogOn; $t.Delay = 'PT30S'; $s = New-ScheduledTaskSettingsSet -Hidden; $s.DisallowStartIfOnBatteries = $false; $s.StopIfGoingOnBatteries = $false; Register-ScheduledTask -Force -TaskName 'PCServer' -TaskPath '\ClaudeAutonomous\' -Action $a -Trigger $t -Settings $s -RunLevel Highest | Out-Null"

REM ── Register bot ───────────────────────────────────────────────────
echo Registering Bot task...
powershell -Command "$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument '\""%REPO%\scripts\launch-bot.vbs\""' -WorkingDirectory '%BOT_DIR%'; $t = New-ScheduledTaskTrigger -AtLogOn; $t.Delay = 'PT60S'; $s = New-ScheduledTaskSettingsSet -Hidden; $s.DisallowStartIfOnBatteries = $false; $s.StopIfGoingOnBatteries = $false; Register-ScheduledTask -Force -TaskName 'Bot' -TaskPath '\ClaudeAutonomous\' -Action $a -Trigger $t -Settings $s -RunLevel Highest | Out-Null"

REM ── Register session trigger (hourly at hh:05) ───────────────────
echo Registering SessionTrigger task...
schtasks /Create /F /TN "ClaudeAutonomous\SessionTrigger" ^
  /TR "C:\Windows\System32\curl.exe -s -X POST http://localhost:8080/session-start" ^
  /SC HOURLY ^
  /MO 1 ^
  /ST 00:05

REM ── Disable battery restrictions on SessionTrigger ────────────────
echo Applying power settings to SessionTrigger...
powershell -Command "$t = Get-ScheduledTask -TaskName 'SessionTrigger' -TaskPath '\ClaudeAutonomous\'; $t.Settings.DisallowStartIfOnBatteries = $false; $t.Settings.StopIfGoingOnBatteries = $false; Set-ScheduledTask -TaskName 'SessionTrigger' -TaskPath '\ClaudeAutonomous\' -Settings $t.Settings"

echo.
echo Done! Three tasks registered under ClaudeAutonomous\
echo   PCServer        — starts 30s after login  (port 3333)
echo   Bot             — starts 60s after login  (port 8080)
echo   SessionTrigger  — fires at hh:05 every hour
echo.
echo To start tasks immediately without rebooting:
echo   schtasks /Run /TN "ClaudeAutonomous\PCServer"
echo   schtasks /Run /TN "ClaudeAutonomous\Bot"
echo.
pause
