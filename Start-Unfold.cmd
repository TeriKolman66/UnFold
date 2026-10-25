@echo off
REM #TeriKolman66
title Unfold local server
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-server.ps1"
if errorlevel 1 pause
