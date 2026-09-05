@echo off
call "D:\hzy\Coding\IDE\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64
if errorlevel 1 exit /b %errorlevel%
"C:\Program Files\nodejs\npm.cmd" run tauri build
echo TAURI_EXIT_CODE=%ERRORLEVEL%
