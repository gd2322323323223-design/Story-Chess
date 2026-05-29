@echo off
cd /d "%~dp0"
echo.
echo  正在啟動本地伺服器...
echo  請在瀏覽器開啟: http://127.0.0.1:8080
echo  按 Ctrl+C 可停止
echo.
python -m http.server 8080 2>nul || py -m http.server 8080
if errorlevel 1 (
  echo.
  echo  找不到 Python，請安裝 Python 或使用 GitHub Pages 線上版本。
  pause
)
