@echo off
title Masaustu Kisayolu Olustur
powershell -NoProfile -Command "$wsh = New-Object -ComObject WScript.Shell; $desktop = [Environment]::GetFolderPath('Desktop'); $s = $wsh.CreateShortcut(\"$desktop\Video Indir ve Donustur.lnk\"); $s.TargetPath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'; $s.Arguments = '--app=http://localhost:3000'; $s.IconLocation = 'C:\Windows\System32\shell32.dll,138'; $s.Save();"
echo.
echo [OK] Masaustune "Video Indir ve Donustur" kisayolu basariyla eklendi!
echo.
pause