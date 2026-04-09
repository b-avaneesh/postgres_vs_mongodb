@echo off
REM MongoDB CSV Data Loader - Windows Batch Script
REM Usage: load-csv.bat [5k|10k|25k]
REM Default: 5k

setlocal enabledelayedexpansion

set DB_SIZE=%1
if "!DB_SIZE!"=="" set DB_SIZE=5k

if "!DB_SIZE!"=="5k" (
    set CSV_SIZE=5000
) else if "!DB_SIZE!"=="10k" (
    set CSV_SIZE=10000
) else if "!DB_SIZE!"=="25k" (
    set CSV_SIZE=25000
) else (
    echo Invalid db_size. Use: 5k, 10k, or 25k
    exit /b 1
)

set MONGO_CONNECTION=mongodb://localhost:27017/healthcare_db
set BASE_DIR=%CD%\..\..\datasets\%CSV_SIZE%

echo.
echo 🚀 MongoDB CSV Data Loader
echo 📦 Dataset Size: !DB_SIZE!
echo 🗄️  Database: healthcare_db
echo 📁 Base Directory: !BASE_DIR!
echo.

REM Import Patients
echo 📥 Importing Patients...
mongoimport --uri "!MONGO_CONNECTION!" --collection patients_!DB_SIZE! --type csv --headerline --mode upsert --file "!BASE_DIR!\patients!CSV_SIZE!.csv"
if errorlevel 1 echo ❌ Patients import failed && exit /b 1
echo ✅ Patients imported

REM Import Doctors
echo 📥 Importing Doctors...
mongoimport --uri "!MONGO_CONNECTION!" --collection doctors_!DB_SIZE! --type csv --headerline --mode upsert --file "!BASE_DIR!\doctors!CSV_SIZE!.csv"
if errorlevel 1 echo ❌ Doctors import failed && exit /b 1
echo ✅ Doctors imported

REM Import Appointments
echo 📥 Importing Appointments...
mongoimport --uri "!MONGO_CONNECTION!" --collection appointments_!DB_SIZE! --type csv --headerline --mode upsert --file "!BASE_DIR!\appointments!CSV_SIZE!.csv"
if errorlevel 1 echo ❌ Appointments import failed && exit /b 1
echo ✅ Appointments imported

REM Import Prescriptions
echo 📥 Importing Prescriptions...
mongoimport --uri "!MONGO_CONNECTION!" --collection prescriptions_!DB_SIZE! --type csv --headerline --mode upsert --file "!BASE_DIR!\prescriptions!CSV_SIZE!.csv"
if errorlevel 1 echo ❌ Prescriptions import failed && exit /b 1
echo ✅ Prescriptions imported

REM Import Billing
echo 📥 Importing Billing...
mongoimport --uri "!MONGO_CONNECTION!" --collection billing_!DB_SIZE! --type csv --headerline --mode upsert --file "!BASE_DIR!\billing!CSV_SIZE!.csv"
if errorlevel 1 echo ❌ Billing import failed && exit /b 1
echo ✅ Billing imported

REM Import Doctor Specializations
echo 📥 Importing Doctor Specializations...
mongoimport --uri "!MONGO_CONNECTION!" --collection doctor_specializations_!DB_SIZE! --type csv --headerline --mode upsert --file "!BASE_DIR!\doctor_specializations!CSV_SIZE!.csv"
if errorlevel 1 echo ❌ Doctor Specializations import failed && exit /b 1
echo ✅ Doctor Specializations imported

REM Import Departments (shared, only if not exists)
echo 📥 Importing Departments ^(shared^)...
mongoimport --uri "!MONGO_CONNECTION!" --collection departments --type csv --headerline --mode upsert --file "!BASE_DIR!\departments!CSV_SIZE!.csv"
echo ℹ️  Departments import completed

echo.
echo ✨ Data loading complete!
echo.
echo 📝 Summary:
echo    - Loaded 6 collections for !DB_SIZE! dataset
echo    - Collections created with pattern: ^<name^>_!DB_SIZE!
echo    - Departments in: departments (shared)
echo    - All data uses integer IDs ^(PostgreSQL compatible^)
echo    - Ready for benchmarking with k6
echo.
