@echo off
REM Run via cmd.exe so `npm` works even when PowerShell blocks npm.ps1
cd /d "%~dp0"
call npm run dev
