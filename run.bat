@echo off
cd /d "%~dp0"
start "" "%LOCALAPPDATA%\Microsoft\WinGet\Packages\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\deno.exe" run --allow-net --allow-read --allow-write --allow-run --allow-env server.ts
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
exit
