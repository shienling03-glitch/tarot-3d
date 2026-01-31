@echo off
echo ========================================
echo 启动本地HTTP服务器
echo ========================================
echo.
echo 服务器地址: http://localhost:8000
echo 按 Ctrl+C 可以停止服务器
echo.
echo 正在启动...
echo.

python -m http.server 8000

pause
