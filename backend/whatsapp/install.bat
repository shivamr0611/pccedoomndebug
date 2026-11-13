@echo off
cd /d "%~dp0"
echo Installing in: %CD%
npm install --fetch-retry-mintimeout 20000 --fetch-retry-maxtimeout 120000 --fetch-retries 5

