@echo off
chcp 65001 >nul
title NovaVid - HD Video Downloader ^& Converter

set "DENO_EXE=%LOCALAPPDATA%\Microsoft\WinGet\Packages\DenoLand.Deno_Microsoft.Winget.Source_8wekyb3d8bbwe\deno.exe"

start "NovaVid_Server" /B "%DENO_EXE%" run --allow-net --allow-read --allow-write --allow-run --allow-env server.ts

timeout /t 1 /nobreak >nul
start "" "msedge.exe" --app=http://localhost:3000
