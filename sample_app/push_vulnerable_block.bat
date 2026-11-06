@echo off
setlocal
echo ========================================================
echo   Switching to VULNERABLE CODE (Triggering BLOCK Build)
echo ========================================================
echo.

cd /d C:\Users\venna\.gemini\antigravity\scratch\securepipeline

copy /y sample_app\app_vulnerable.py sample_app\app.py
copy /y sample_app\requirements_vulnerable.txt sample_app\requirements.txt

git add sample_app\app.py sample_app\requirements.txt
git commit -m "test: introduce intentional vulnerabilities to verify security gate BLOCK"
echo Pushing vulnerable code to GitHub...
git push origin master

echo.
echo ========================================================
echo   VULNERABLE CODE PUSHED!
echo   The Security Gate will now evaluate as:
echo   [BLOCK] DEPLOYMENT BLOCKED (Red)
echo ========================================================
pause
