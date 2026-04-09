@echo off
REM Quick Setup Script for MongoDB CSV Loading
REM This script validates prerequisites and guides through setup

setlocal enabledelayedexpansion

echo.
echo ========================================
echo MongoDB CSV Data Loading - Quick Setup
echo ========================================
echo.

REM Check if mongoimport is available
echo Checking prerequisites...

mongoimport --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ❌ ERROR: mongoimport not found!
    echo.
    echo MongoDB Database Tools must be installed.
    echo Download from: https://www.mongodb.com/try/download/database-tools
    echo.
    echo After installation, add to your PATH or edit this script with full path.
    exit /b 1
) else (
    echo ✅ mongoimport found
)

REM Check if MongoDB is running
echo Checking MongoDB connection...

mongoimport --uri "mongodb://localhost:27017/healthcare_db" --dry-run >nul 2>&1
if errorlevel 1 (
    echo ⚠️  WARNING: MongoDB may not be running
    echo Run: mongod
    echo.
) else (
    echo ✅ MongoDB connection OK
)

REM Check if datasets directory exists
if exist "..\..\datasets\5000\" (
    echo ✅ Dataset files found
) else (
    echo ❌ ERROR: Dataset directory not found
    echo Expected: ..\..\datasets\5000\
    exit /b 1
)

echo.
echo ========================================
echo Which dataset size do you want to load?
echo ========================================
echo.
echo 1) 5k  (Default)
echo 2) 10k (Larger)
echo 3) 25k (Largest)
echo.

REM Default to 5k
set choice=1

if "%1"=="10k" set choice=2
if "%1"=="25k" set choice=3

if "!choice!"=="1" (
    echo Loading 5k dataset...
    call load-csv.bat 5k
) else if "!choice!"=="2" (
    echo Loading 10k dataset...
    call load-csv.bat 10k
) else if "!choice!"=="3" (
    echo Loading 25k dataset...
    call load-csv.bat 25k
) else (
    echo Loading 5k dataset ^(default^)...
    call load-csv.bat 5k
)

echo.
echo Next steps:
echo 1. Verify data in MongoDB shell:
echo    use healthcare_db
echo    db.patients_5k.countDocuments^(^)
echo.
echo 2. Run k6 benchmarks:
echo    cd ..\..
echo    k6 run stress-test\k6.script.js
echo.
