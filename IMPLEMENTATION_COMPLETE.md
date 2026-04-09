# ✅ MongoDB CSV Integration - Complete Implementation Summary

## Overview
MongoDB has been fully converted to support **integer IDs matching PostgreSQL**, enabling direct CSV data import and fair benchmarking comparison.

---

## 📋 Changes Implemented

### 1. Schema Changes (All Files Converted)

**Before:** `mongoose.Schema.Types.ObjectId`  
**After:** `Number`

#### Updated Schemas:
```javascript
// Doctor Schema
department_id: Number  // Was: ObjectId

// Appointment Schema
patient_id: Number     // Was: ObjectId
doctor_id: Number      // Was: ObjectId

// Prescription Schema  
appointment_id: Number // Was: ObjectId
patient_id: Number     // Was: ObjectId
doctor_id: Number      // Was: ObjectId

// Billing Schema
appointment_id: Number // Was: ObjectId
patient_id: Number     // Was: ObjectId

// Doctor Specialization Schema
doctor_id: Number      // Was: ObjectId
```

### 2. Code Changes

#### ObjectId Removal:
```javascript
// BEFORE
matchStage._id = new mongoose.Types.ObjectId(doctor_id);

// AFTER
matchStage._id = Number(doctor_id);
```

#### Removed:
- ✅ All `populate()` calls (no references in schemas)
- ✅ All `mongoose.Types.ObjectId()` conversions
- ✅ ObjectId type declarations

#### Updated:
- ✅ All aggregation pipelines for numeric IDs
- ✅ All match stages for numeric IDs
- ✅ All lookups for numeric relationships

---

## 🚀 Data Loading Tools Created

### 1. PowerShell Script (`load-csv.ps1`)
**Best for:** Windows users with modern PowerShell

```powershell
.\load-csv.ps1 -DbSize 5k
```

**Features:**
- ✅ Automatic CSV discovery
- ✅ Error handling
- ✅ Progress tracking
- ✅ Color-coded output
- ✅ Index creation guidance

### 2. Batch Script (`load-csv.bat`)
**Best for:** Windows CMD users

```cmd
load-csv.bat 5k
```

**Features:**
- ✅ Simple command-line interface
- ✅ Error detection
- ✅ Multiple dataset support
- ✅ Easy to automate

### 3. Node.js Script (`load-csv.js`)
**Best for:** Cross-platform automation

```bash
node load-csv.js 5k
```

**Features:**
- ✅ Automatic index creation
- ✅ Error recovery
- ✅ Stdout logging
- ✅ Process management

### 4. Quick Setup Script (`setup.bat`)
**Best for:** First-time users

```cmd
setup.bat
```

**Features:**
- ✅ Prerequisites checking
- ✅ Interactive menu
- ✅ MongoDB validation
- ✅ Dataset verification

---

## 📚 Documentation Files

| File | Purpose | Contents |
|------|---------|----------|
| `CSV_LOADING_GUIDE.md` | Complete guide | Detailed setup, troubleshooting, manual commands |
| `mongo.controller.js` | Updated code | All Number IDs, removed ObjectId |
| `load-csv.ps1` | PowerShell loader | Automated import with error handling |
| `load-csv.bat` | Batch loader | Windows CMD automation |
| `load-csv.js` | Node loader | Cross-platform automation |
| `setup.bat` | Quick setup | Prerequisites check & guided import |

---

## 🎯 Supported Dataset Sizes

| Size | Collections | Pattern | Example |
|------|-------------|---------|---------|
| **5k** | 6 sized + departments | `<name>_5k` | `patients_5k` |
| **10k** | 6 sized + departments | `<name>_10k` | `patients_10k` |
| **25k** | 6 sized + departments | `<name>_25k` | `patients_25k` |

### Collections Per Size:
1. `patients_<size>`
2. `doctors_<size>`
3. `appointments_<size>`
4. `prescriptions_<size>`
5. `billing_<size>`
6. `doctor_specializations_<size>`
7. `departments` (shared across all sizes)

---

## 📍 Collection Names & Indexing

### Indexes Created (Automatic):
```javascript
// For each dataset size
patients_5k              → patient_id
doctors_5k               → doctor_id, department_id
appointments_5k          → patient_id, doctor_id
prescriptions_5k         → appointment_id, patient_id, doctor_id
billing_5k               → appointment_id, patient_id
doctor_specializations_5k → doctor_id
departments              → department_id
```

---

## 🔄 PostgreSQL ↔ MongoDB Data Mapping

| Field | PostgreSQL Type | MongoDB Type | Example |
|-------|-----------------|--------------|---------|
| patient_id | INTEGER | Number | 1, 2, 3... |
| doctor_id | INTEGER | Number | 1, 2, 3... |
| appointment_id | INTEGER | Number | 1, 2, 3... |
| department_id | INTEGER | Number | 1, 2, 3... |
| Names | VARCHAR | String | "John Doe" |
| Dates | DATE/TIMESTAMP | Date | 2026-04-08T... |
| Amounts | DECIMAL | Number | 50.00, 20.00... |

---

## ✨ Key Benefits

| Feature | Before | After |
|---------|--------|-------|
| **ID Format** | ObjectId (24-char hex) | Integer (1, 2, 3...) |
| **CSV Import** | ❌ Requires transformation | ✅ Direct mongoimport |
| **PostgreSQL Match** | ❌ Different ID types | ✅ Identical integers |
| **Benchmarking** | ❌ Unfair comparison | ✅ Fair comparison |
| **Data Volume** | ❌ Manual insertion | ✅ Bulk import |
| **Performance** | Undefined | Optimized with indexes |
| **Query Compatibility** | Partial | ✅ Full parity |

---

## 🚀 Quick Start Guide

### Step 1: Navigate to MongoDB service
```cmd
cd services\mongo
```

### Step 2: Choose ONE loading method

**Option A - Quick Setup (Guided)**
```cmd
setup.bat
```

**Option B - PowerShell (Recommended)**
```powershell
.\load-csv.ps1 -DbSize 5k
```

**Option C - Batch (Simple)**
```cmd
load-csv.bat 5k
```

**Option D - Node.js (Full automation)**
```bash
node load-csv.js 5k
```

### Step 3: Verify Import
```javascript
use healthcare_db
db.patients_5k.countDocuments()  // Should return count
db.doctors_5k.countDocuments()
```

### Step 4: Run Benchmarks
```bash
cd ..\..
k6 run stress-test/k6.script.js
```

---

## 🔍 File Locations

```
Postgres vs MongoDB/
├── services/mongo/
│   ├── mongo.controller.js          ✅ Updated with Number IDs
│   ├── load-csv.ps1                 ✅ PowerShell loader
│   ├── load-csv.bat                 ✅ Batch loader
│   ├── load-csv.js                  ✅ Node.js loader
│   ├── setup.bat                    ✅ Quick setup
│   ├── CSV_LOADING_GUIDE.md         ✅ Complete guide
│   └── .env                         (Already configured)
│
├── datasets/
│   ├── 5000/                        (5k CSV files)
│   ├── 10000/                       (10k CSV files)
│   └── 25000/                       (25k CSV files)
│
├── MONGODB_CSV_SETUP.md             ✅ This summary
└── stress-test/
    └── k6.script.js                 (For benchmarking)
```

---

## 📊 What Gets Loaded

### Per Dataset Size (5k/10k/25k):
- **Patients** - 5,000/10,000/25,000 records
- **Doctors** - ~500 doctor records per size
- **Appointments** - ~20,000/40,000/100,000 related to patients/doctors
- **Prescriptions** - Linked to appointments
- **Billing** - One per appointment
- **Doctor Specializations** - One per doctor
- **Departments** - ~10 shared departments (loaded once)

---

## ✅ Verification Checklist

After running loader, verify:

```javascript
use healthcare_db

// ✅ Check collections exist
show collections

// ✅ Check document counts
db.patients_5k.countDocuments()
db.doctors_5k.countDocuments()
db.appointments_5k.countDocuments()

// ✅ Verify integer IDs
db.doctors_5k.findOne()
// Output should show: "doctor_id": 1, "department_id": 1 (numbers, not objects)

// ✅ Check indexes
db.patients_5k.getIndexes()

// ✅ Verify relationships work
db.appointments_5k.findOne()
// Should show: "patient_id": 123, "doctor_id": 45 (integers)
```

---

## 🛠️ Troubleshooting

### Issue: mongoimport not found
**Solution:**
- Download: https://www.mongodb.com/try/download/database-tools
- Add to PATH or use full path in scripts

### Issue: MongoDB connection refused
**Solution:**
- Start MongoDB: `mongod`
- Check connection string in script
- Verify port 27017 is accessible

### Issue: CSV files not found
**Solution:**
- Verify dataset directory exists
- Check path: `datasets/5000/`, `datasets/10000/`, `datasets/25000/`
- Files should be named: `patients5000.csv`, `doctors10000.csv`, etc.

### Issue: Collection already exists
**Solution:**
- Scripts use `--mode upsert` to update existing data
- Or drop collection first: `db.collection_name.drop()`

---

## 📞 Support Reference

**Configuration File:**
```
services/mongo/.env
MONGO_CONNECTION_STRING=mongodb://localhost:27017/healthcare_db
MONGO_SERVER_PORT=8000
```

**Key Scripts:**
- Data Loading: `load-csv.ps1`, `load-csv.bat`, `load-csv.js`
- Quick Setup: `setup.bat`
- Documentation: `CSV_LOADING_GUIDE.md`

**MongoDB Commands for Verification:**
```javascript
use healthcare_db
db.patients_5k.findOne()
db.doctors_5k.findOne()
db.appointments_5k.findOne()
db.billing_5k.findOne()
```

---

## 🎯 Result

✅ **MongoDB now has:**
- Integer IDs matching PostgreSQL
- Direct CSV import capability
- Optimized indexes
- Fair benchmarking potential
- Production-ready schema

**Ready to run k6 benchmarks and compare!** 🚀

---

## 📝 Next Steps

1. **Run data loader** (choose one):
   ```
   .\load-csv.ps1 -DbSize 5k
   ```

2. **Verify data** in MongoDB shell:
   ```
   use healthcare_db
   db.patients_5k.countDocuments()
   ```

3. **Start benchmarking**:
   ```
   k6 run stress-test/k6.script.js
   ```

4. **Compare results** between PostgreSQL and MongoDB!

---

**Implementation Date:** April 8, 2026  
**Status:** ✅ Complete and Ready for Testing
