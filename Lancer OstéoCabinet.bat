@echo off
chcp 65001 >nul
title OstéoCabinet — Serveur local
color 0A
echo.
echo  =========================================
echo    OstéoCabinet — Verification...
echo  =========================================
echo.

:: ─── 1. Vérification de Python ──────────────────────────────────────────────
echo  [1/2] Verification de Python...
python --version >nul 2>&1
if not errorlevel 1 goto :python_ok

:: Python absent — tentative d'installation
echo.
echo  [!] Python n'est pas installe. Installation automatique...
echo.

:: Tentative via winget (Windows 10/11)
winget --version >nul 2>&1
if errorlevel 1 goto :fallback_download

echo  Installation via winget, veuillez patienter...
winget install --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
if errorlevel 1 goto :fallback_download

echo.
echo  [OK] Python installe avec succes via winget.
echo  Relancez ce fichier pour demarrer OsteoCabinet.
echo.
pause
exit /b 0

:fallback_download
echo  [!] Tentative de telechargement de l'installateur Python...
echo.
powershell -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.9/python-3.12.9-amd64.exe' -OutFile '%TEMP%\python_installer.exe'" >nul 2>&1
if errorlevel 1 goto :no_internet

echo  Lancement de l'installation (cochez "Add Python to PATH" si demande)...
"%TEMP%\python_installer.exe" /passive PrependPath=1
echo.
echo  [OK] Installation terminee.
echo  Relancez ce fichier pour demarrer OsteoCabinet.
echo.
pause
exit /b 0

:no_internet
echo.
echo  [ERREUR] Impossible d'installer Python automatiquement.
echo  Telechargez-le manuellement : https://www.python.org/downloads/
echo  Cochez bien "Add Python to PATH" lors de l'installation.
echo.
pause
exit /b 1

:python_ok
for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo  [OK] Python %PYVER% detecte.

:: ─── 2. Vérification des modules Python ─────────────────────────────────────
echo  [2/2] Verification des modules Python...
python -c "import http.server, json, os, threading, webbrowser, urllib.parse" >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERREUR] Modules Python manquants.
    echo  Reinstallez Python : https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)
echo  [OK] Tous les modules sont disponibles.

:: ─── Lancement ───────────────────────────────────────────────────────────────
echo.
echo  =========================================
echo    OstéoCabinet — Lancement en cours...
echo  =========================================
echo.
echo  Donnees : %~dp0osteo.db
echo.
echo  Ne fermez pas cette fenetre pendant
echo  l'utilisation du logiciel.
echo  =========================================
echo.
echo  Lancement termine. La fenetre se reduit...
powershell -windowstyle minimized -command "" >nul 2>&1

python "%~dp0server.py"

echo.
echo  Le serveur s'est arrete.
echo  Verifiez qu'aucune autre instance n'est deja en cours.
echo.
pause
