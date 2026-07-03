@echo off
echo Starting GeoCyclone India...

echo.
echo [1/2] Spinning up Python FastAPI Backend Server...
start cmd /k "cd backend && ..\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo.
echo [2/2] Spinning up React-Vite Frontend Client...
start cmd /k "cd frontend && npm run dev"

echo.
echo GeoCyclone India is launching!
echo Backend API available at: http://127.0.0.1:8000
echo Frontend Dashboard loading... check the opened console windows.
echo.
pause
