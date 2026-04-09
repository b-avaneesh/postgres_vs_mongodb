# MongoDB CSV Data Loading Guide

## Overview
MongoDB schemas have been updated to use **integer IDs** (matching PostgreSQL) instead of ObjectId references. This enables direct CSV data import via `mongoimport` and ensures 100% compatibility with PostgreSQL benchmarking.

---

## Schema Changes

### Before (ObjectId)
```javascript
patientSchema = {
    patient_id: mongoose.Schema.Types.ObjectId  // ❌ Incompatible with CSV
}
```

### After (Number)
```javascript
patientSchema = {
    patient_id: Number  // ✅ Matches PostgreSQL integers
}
```

**All schemas updated:**
- `patients` → `patient_id: Number`
- `doctors` → `doctor_id: Number`, `department_id: Number`
- `appointments` → `patient_id: Number`, `doctor_id: Number`, `appointment_id: Number`
- `prescriptions` → `appointment_id: Number`, `patient_id: Number`, `doctor_id: Number`
- `billing` → `appointment_id: Number`, `patient_id: Number`
- `doctor_specializations` → `doctor_id: Number`
- `departments` → `department_id: Number`

---

## Data Loading Options

### Option 1: PowerShell Script (Recommended for Windows)

```powershell
# Load 5k dataset (default)
.\load-csv.ps1

# Load 10k dataset
.\load-csv.ps1 -DbSize 10k

# Load 25k dataset
.\load-csv.ps1 -DbSize 25k
```

**Benefits:**
- Automatic CSV file discovery
- Error handling
- Index creation guidance
- Color-coded output

---

### Option 2: Node.js Script

```bash
# Load 5k dataset
node load-csv.js 5k

# Load 10k dataset
node load-csv.js 10k

# Load 25k dataset
node load-csv.js 25k
```

**Features:**
- Automatic index creation
- Progress tracking
- Error recovery

---

### Option 3: Batch Script (Windows CMD)

```cmd
# Load 5k dataset
load-csv.bat 5k

# Load 10k dataset
load-csv.bat 10k

# Load 25k dataset
load-csv.bat 25k
```

---

### Option 4: Manual mongoimport Commands

If you prefer direct control, use these commands:

#### 5k Dataset
```bash
mongoimport --uri "mongodb://localhost:27017/healthcare_db" \
  --collection patients_5k \
  --type csv --headerline --mode upsert \
  --file datasets/5000/patients5000.csv

mongoimport --uri "mongodb://localhost:27017/healthcare_db" \
  --collection doctors_5k \
  --type csv --headerline --mode upsert \
  --file datasets/5000/doctors5000.csv

mongoimport --uri "mongodb://localhost:27017/healthcare_db" \
  --collection appointments_5k \
  --type csv --headerline --mode upsert \
  --file datasets/5000/appointments5000.csv

mongoimport --uri "mongodb://localhost:27017/healthcare_db" \
  --collection prescriptions_5k \
  --type csv --headerline --mode upsert \
  --file datasets/5000/prescriptions5000.csv

mongoimport --uri "mongodb://localhost:27017/healthcare_db" \
  --collection billing_5k \
  --type csv --headerline --mode upsert \
  --file datasets/5000/billing5000.csv

mongoimport --uri "mongodb://localhost:27017/healthcare_db" \
  --collection doctor_specializations_5k \
  --type csv --headerline --mode upsert \
  --file datasets/5000/doctor_specializations5000.csv

mongoimport --uri "mongodb://localhost:27017/healthcare_db" \
  --collection departments \
  --type csv --headerline --mode upsert \
  --file datasets/5000/departments5000.csv
```

#### 10k Dataset
Replace `5000` with `10000` and `_5k` with `_10k` in collection names

#### 25k Dataset  
Replace `5000` with `25000` and `_5k` with `_25k` in collection names

---

## Create Indexes (Optional but Recommended)

For better query performance, create indexes using MongoDB shell:

```javascript
use healthcare_db

// 5k dataset indexes
db.patients_5k.createIndex({ patient_id: 1 })
db.doctors_5k.createIndex({ doctor_id: 1, department_id: 1 })
db.appointments_5k.createIndex({ patient_id: 1, doctor_id: 1 })
db.prescriptions_5k.createIndex({ appointment_id: 1, patient_id: 1, doctor_id: 1 })
db.billing_5k.createIndex({ appointment_id: 1, patient_id: 1 })
db.doctor_specializations_5k.createIndex({ doctor_id: 1 })
db.departments.createIndex({ department_id: 1 })

// Repeat for 10k and 25k datasets (change collection suffixes)
```

---

## Verify Data Import

```javascript
use healthcare_db

// Check document count
db.patients_5k.countDocuments()      // Should match CSV row count
db.doctors_5k.countDocuments()
db.appointments_5k.countDocuments()
db.prescriptions_5k.countDocuments()
db.billing_5k.countDocuments()
db.doctor_specializations_5k.countDocuments()
db.departments.countDocuments()

// View sample document
db.patients_5k.findOne()
db.doctors_5k.findOne()
db.appointments_5k.findOne()
```

---

## Code Changes

### All ObjectId References Removed
- ✅ `mongoose.Schema.Types.ObjectId` → `Number`
- ✅ `new mongoose.Types.ObjectId(id)` → `Number(id)`
- ✅ All aggregation pipelines use numeric IDs

### Example: Revenue Report Query
**Before (ObjectId):**
```javascript
matchStage._id = new mongoose.Types.ObjectId(doctor_id);
```

**After (Number):**
```javascript
matchStage._id = Number(doctor_id);
```

---

## Consistency with PostgreSQL

| Feature | PostgreSQL | MongoDB |
|---------|-----------|---------|
| ID Type | INTEGER | Number |
| Doctor FK | department_id (INT) | department_id: Number |
| Relationships | Foreign Keys | Integer References |
| Aggregations | JOINs | $lookup |
| Response Format | Identical | Identical |

---

## Key Benefits

✅ **CSV Compatible** - Direct import without transformation  
✅ **PostgreSQL Parity** - Identical integer IDs  
✅ **Fair Benchmarking** - Both DBs use same data format  
✅ **Production Ready** - Proper schema normalization  
✅ **Multiple Datasets** - 5k, 10k, 25k support  
✅ **Automatic Indexing** - Performance optimization included  

---

## Troubleshooting

### CSV file not found
- Ensure `datasets/5000/`, `datasets/10000/`, `datasets/25000/` directories exist
- Verify filenames match exactly (case-sensitive on Linux/Mac)

### mongoimport not found
- Install MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools
- Ensure `mongoimport` is in PATH or provide full path

### Duplicate key errors
- Use `--mode upsert` flag (already in scripts)
- Or drop collection first: `db.collection_name.drop()`

### Connection refused
- Ensure MongoDB is running: `mongod`
- Check connection string matches your setup

---

## Next Steps

1. **Load Data:**
   ```powershell
   .\load-csv.ps1 -DbSize 5k
   ```

2. **Verify Import:**
   ```javascript
   use healthcare_db
   db.patients_5k.countDocuments()
   ```

3. **Run Benchmarks:**
   ```bash
   k6 run stress-test/k6.script.js
   ```

4. **Compare Results:**
   - PostgreSQL vs MongoDB with same integer IDs
   - Fair apples-to-apples comparison

---

## Configuration

**Environment Variables (.env)**
```
MONGO_CONNECTION_STRING=mongodb://localhost:27017/healthcare_db
MONGO_SERVER_PORT=8000
```

---

## Support

For issues with data loading:
1. Check MongoDB connection
2. Verify file paths
3. Review mongoimport errors
4. Ensure sufficient disk space
5. Check file permissions

---
