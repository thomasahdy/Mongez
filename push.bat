@echo off

cd /d backend\mongez

call npm install
if errorlevel 1 goto error

call npx prisma generate
if errorlevel 1 goto error

call npx prisma db push
if errorlevel 1 goto error

call npm run start:dev
if errorlevel 1 goto error

goto end

:error
echo.
echo Command failed. Check the error message above.
pause
exit /b 1

:end
pause