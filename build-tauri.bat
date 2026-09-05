@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat" -arch=x64
if errorlevel 1 exit /b %errorlevel%
"C:\Program Files\nodejs\npm.cmd" run tauri build
echo TAURI_EXIT_CODE=%ERRORLEVEL%
