# MongoDB CSV Data Loader - PowerShell Script
# Usage: .\load-csv.ps1 -DbSize 5k|10k|25k
# Default: 5k

param(
    [string]$DbSize = "5k"
)

# Validate db size
$validSizes = @("5k", "10k", "25k")
if ($validSizes -notcontains $DbSize) {
    Write-Error "Invalid db_size. Use: 5k, 10k, or 25k"
    exit 1
}

# Map db_size to CSV folder size
$sizeMap = @{
    "5k"  = "5000"
    "10k" = "10000"
    "25k" = "25000"
}

$csvSize = $sizeMap[$DbSize]
$mongoConnection = "mongodb://localhost:27017/healthcare_db"
$baseDir = Join-Path (Split-Path $PSScriptRoot -Parent) "..\..\datasets\$csvSize" | Resolve-Path -ErrorAction SilentlyContinue

if (-not $baseDir) {
    Write-Error "Dataset directory not found: datasets\$csvSize"
    exit 1
}

Write-Host ""
Write-Host "🚀 MongoDB CSV Data Loader" -ForegroundColor Cyan
Write-Host "📦 Dataset Size: $DbSize" -ForegroundColor Yellow
Write-Host "🗄️  Database: healthcare_db" -ForegroundColor Yellow
Write-Host "📁 Base Directory: $baseDir" -ForegroundColor Yellow
Write-Host ""

# Define collections to import
$collections = @(
    @{ file = "patients$csvSize.csv"; collection = "patients_$DbSize"; description = "Patients" },
    @{ file = "doctors$csvSize.csv"; collection = "doctors_$DbSize"; description = "Doctors" },
    @{ file = "appointments$csvSize.csv"; collection = "appointments_$DbSize"; description = "Appointments" },
    @{ file = "prescriptions$csvSize.csv"; collection = "prescriptions_$DbSize"; description = "Prescriptions" },
    @{ file = "billing$csvSize.csv"; collection = "billing_$DbSize"; description = "Billing" },
    @{ file = "doctor_specializations$csvSize.csv"; collection = "doctor_specializations_$DbSize"; description = "Doctor Specializations" }
)

# Function to import CSV
function Import-MongoCSV {
    param(
        [string]$File,
        [string]$Collection,
        [string]$Description
    )
    
    $csvPath = Join-Path $baseDir $File
    
    if (-not (Test-Path $csvPath)) {
        Write-Error "CSV file not found: $csvPath"
        return $false
    }
    
    Write-Host "📥 Importing $Description..." -ForegroundColor Cyan
    Write-Host "   File: $csvPath" -ForegroundColor Gray
    Write-Host "   Collection: $Collection" -ForegroundColor Gray
    
    try {
        & mongoimport --uri "$mongoConnection" --collection $Collection `
            --type csv --headerline --mode upsert --file "$csvPath"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $Description imported successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Error "$Description import failed (exit code: $LASTEXITCODE)"
            return $false
        }
    } catch {
        Write-Error "Error importing $Description : $_"
        return $false
    }
}

# Import all collections
$importedCount = 0
foreach ($col in $collections) {
    if (Import-MongoCSV -File $col.file -Collection $col.collection -Description $col.description) {
        $importedCount++
    } else {
        Write-Error "Failed to import $($col.description)"
        exit 1
    }
}

# Import departments (shared, non-critical if already exists)
Write-Host ""
Write-Host "📥 Importing Departments (shared)..." -ForegroundColor Cyan
$deptFile = Join-Path $baseDir "departments$csvSize.csv"
if (Test-Path $deptFile) {
    & mongoimport --uri "$mongoConnection" --collection departments `
        --type csv --headerline --mode upsert --file "$deptFile" 2>$null
    Write-Host "✅ Departments imported or already exists" -ForegroundColor Green
} else {
    Write-Host "⚠️  Departments CSV not found (may already exist)" -ForegroundColor Yellow
}

# Create indexes
Write-Host ""
Write-Host "📊 Creating indexes for performance..." -ForegroundColor Cyan

# Note: For production, use MongoDB shell commands or application-level indexing
Write-Host "⚠️  Run the following in MongoDB shell for indexes:" -ForegroundColor Yellow
Write-Host ""
Write-Host "use healthcare_db" -ForegroundColor Gray
Write-Host "db.patients_$DbSize.createIndex({ patient_id: 1 })" -ForegroundColor Gray
Write-Host "db.doctors_$DbSize.createIndex({ doctor_id: 1, department_id: 1 })" -ForegroundColor Gray
Write-Host "db.appointments_$DbSize.createIndex({ patient_id: 1, doctor_id: 1 })" -ForegroundColor Gray
Write-Host "db.prescriptions_$DbSize.createIndex({ appointment_id: 1, patient_id: 1, doctor_id: 1 })" -ForegroundColor Gray
Write-Host "db.billing_$DbSize.createIndex({ appointment_id: 1, patient_id: 1 })" -ForegroundColor Gray
Write-Host "db.doctor_specializations_$DbSize.createIndex({ doctor_id: 1 })" -ForegroundColor Gray
Write-Host "db.departments.createIndex({ department_id: 1 })" -ForegroundColor Gray
Write-Host ""

Write-Host "✨ Data loading complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Summary:" -ForegroundColor Cyan
Write-Host "   - Loaded $importedCount collection(s) for $DbSize dataset" -ForegroundColor Gray
Write-Host "   - Collections created with pattern: <name>_$DbSize" -ForegroundColor Gray
Write-Host "   - Departments in: departments (shared)" -ForegroundColor Gray
Write-Host "   - All data uses integer IDs (PostgreSQL compatible)" -ForegroundColor Gray
Write-Host "   - Ready for benchmarking with k6" -ForegroundColor Gray
Write-Host ""
