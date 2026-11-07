@echo off
chcp 65001 >nul
title TopNote - 本地学习笔记
set "PATH=C:\Users\10405\nodejs-portable\node-v22.23.4-win-x64;%PATH%"
cd /d "%~dp0"

echo ==============================================
echo   TopNote 正在启动…
echo   关闭本窗口即退出应用
echo ==============================================

rem 延时 6 秒后自动打开浏览器（等待前后端就绪）
start "" cmd /c "timeout /t 6 /nobreak >nul & start "" http://localhost:5173"

npm run dev
pause
