@echo off
chcp 65001 >nul
title Cute Low-Poly Game - LAN Server and Client Launcher

cd /d "%~dp0"

echo ======================================================================
echo    DONG CO THO MONG / TRUONG AN CO DO - CHAY GAME ONLINE LAN
echo ======================================================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :NO_NODE

if exist "node_modules\" goto :GET_IP
echo [1/3] Dang cai dat thu vien can thiet (npm install)...
call npm install
if errorlevel 1 goto :INSTALL_ERR
echo.

:GET_IP
set "LAN_IP=localhost"
for /f "delims=" %%i in ('node -e "const os=require('os'),nets=os.networkInterfaces(),ips=[],skip=['wsl','warp','virtual','vmware','vbox','loopback'];for(const k of Object.keys(nets)){if(skip.some(function(w){return k.toLowerCase().includes(w)}))continue;for(const n of nets[k]){if(n.family==='IPv4')if(n.internal===false)if(n.address.startsWith('169.254.')===false)ips.push(n.address)}}ips.sort(function(a,b){return(b.startsWith('192.168.')?1:0)-(a.startsWith('192.168.')?1:0)});console.log(ips[0]?ips[0]:'localhost')"') do set "LAN_IP=%%i"

echo ----------------------------------------------------------------------
echo   THONG TIN KET NOI TRONG MANG LAN (Wi-Fi / Day mang chung):
echo.
echo   * May chu (May cua ban):
echo     Web Game : http://localhost:5173
echo     Server WS: ws://localhost:3000
echo.
echo   * Ban be trong cung mang LAN mo trinh duyet vao dia chi:
echo     Web Game : http://%LAN_IP%:5173
echo     Server WS: ws://%LAN_IP%:3000 (Tu dong dien san khi vao link tren)
echo.
echo   * Luu y: Neu may khac khong vao duoc, hay bam "Allow access" khi
echo     Windows Firewall hoi quyen cho Node.js (cong 5173 va 3000).
echo ----------------------------------------------------------------------
echo.

echo [Khoi dong] Dang bat May chu Dau Truong Online (WebSocket Port 3000)...
start "Cute Low-Poly - Multiplayer WS Server (Port 3000)" cmd /k "cd /d "%~dp0" && node server.js"

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5173"

echo [Khoi dong] Dang bat Web Client cho toan mang LAN (Port 5173)...
echo.
call npm run dev -- --host 0.0.0.0 --port 5173
pause
goto :EOF

:NO_NODE
echo [LOI] Khong tim thay Node.js! Vui long cai dat Node.js tu https://nodejs.org/
pause
exit /b 1

:INSTALL_ERR
echo [LOI] Cai dat thu vien that bai!
pause
exit /b 1
