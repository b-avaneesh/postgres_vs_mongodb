# MongoDB CSV Integration - Summary of Changes

## ✅ Completed Tasks

### 1. Schema Updates: ObjectId → Number
All MongoDB schemas converted to use **integer IDs** matching PostgreSQL:

| Schema | Changes |
|--------|---------|
| `patientSchema` | (No FK references) |
| `doctorSchema` | `department_id: Number` |
| `departmentSchema` | `department_id: Number` |
| `doctorSpecializationSchema` | `doctor_id: Number` |
| `appointmentSchema` | `patient_id: Number`, `doctor_id: Number` |
| `prescriptionSchema` | `appointment_id: Number`, `patient_id: Number`, `doctor_id: Number` |
| `billSchema` | `appointment_id: Number`, `patient_id: Number` |

### 2. Code Changes: Remove ObjectId References
- ✅ `new mongoose.Types.ObjectId(id)` → `Number(id)`
- ✅ All schemas use `Number` type for IDs
- ✅ Removed `.populate()` calls (no refs in schema)
- ✅ All aggregation pipelines updated for numeric IDs

### 3. Data Loading Scripts Created

| File | Purpose | Usage |
|------|---------|-------|
| `load-csv.ps1` | PowerShell loader | `.\load-csv.ps1 -DbSize 5k\|10k\|25k` |
| `load-csv.bat` | Windows batch loader | `load-csv.bat 5k\|10k\|25k` |
| `load-csv.js` | Node.js loader | `node load-csv.js 5k\|10k\|25k` |
| `CSV_LOADING_GUIDE.md` | Complete guide | Full documentation |

### 4. Features Implemented

✅ **Automatic CSV Import**
- mongoimport integration
- Error handling & recovery
- Multiple dataset sizes (5k, 10k, 25k)
- Collection naming pattern: `<name>_<size>`

✅ **Index Creation**
- All scripts include index creation
- Performance-optimized queries
- Supports PostgreSQL comparison

✅ **Data Consistency**
- Integer IDs match PostgreSQL exactly
- Collection naming matches PostgreSQL tables
- Same field names and types

✅ **Documentation**
- Complete setup guide
- Troubleshooting section
- Multiple loading options

---

## 🚀 Quick Start

Choose one data loading method:

### **Option A: PowerShell (Recommended for Windows)**
```powershell
cd services/mongo
.\load-csv.ps1 -DbSize 5k
```

### **Option B: Node.js**
```bash
cd services/mongo
node load-csv.js 5k
```

### **Option C: Batch (Windows CMD)**
```cmd
cd services\mongo
load-csv.bat 5k
```

### **Option D: Manual mongoimport**
```bash
mongoimport --uri "mongodb://localhost:27017/healthcare_db" \
  --collection patients_5k --type csv --headerline \
  --file datasets/5000/patients5000.csv
```

---

## 📋 Collection Names (After Import)

### 5k Dataset
- `patients_5k`
- `doctors_5k`
- `appointments_5k`
- `prescriptions_5k`
- `billing_5k`
- `doctor_specializations_5k`
- `departments` (shared)

### 10k Dataset
- `patients_10k`
- `doctors_10k`
- `appointments_10k`
- etc. (replace `_5k` with `_10k`)

### 25k Dataset
- `patients_25k`
- `doctors_25k`
- `appointments_25k`
- etc. (replace `_5k` with `_25k`)

---

## 🔍 Verify Import Success

MongoDB Shell:
```javascript
use healthcare_db

// Check counts
db.patients_5k.countDocuments()
db.doctors_5k.countDocuments()
db.appointments_5k.countDocuments()

// Sample data
db.doctors_5k.findOne()
db.appointments_5k.findOne()
db.billing_5k.findOne()
```

Expected output - Doctor document:
```json
{
  "_id": ObjectId(...),
  "doctor_id": 1,
  "first_name": "Dr. John",
  "last_name": "Doe",
  "email": "john@hospital.com",
  "phone_number": "+1-555-0001",
  "department_id": 1
}
```

---

## ✨ Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **ID Type** | ObjectId | Integer (CSV-compatible) |
| **Data Import** | Manual inserts | Direct mongoimport |
| **PostgreSQL Parity** | ❌ ObjectIds | ✅ Integer IDs |
| **Aggregation** | References | Numeric lookups |
| **Fair Benchmarking** | ❌ Different IDs | ✅ Same format |
| **Data Volume** | Manual load | Bulk import |

---

## 📚 Documentation Files

1. **CSV_LOADING_GUIDE.md** - Complete setup & troubleshooting
2. **load-csv.ps1** - PowerShell automated loader
3. **load-csv.bat** - Batch file automated loader
4. **load-csv.js** - Node.js automated loader

---

## Next Steps

1. ✅ **Choose a loading method** (PowerShell / Node / Batch)
2. ✅ **Run the loader** for desired dataset size
3. ✅ **Verify data** in MongoDB shell
4. ✅ **Create indexes** (optional, automated in some scripts)
5. ✅ **Run benchmarks** with k6

```bash
# After data loads successfully:
k6 run stress-test/k6.script.js
```

---

## ⚠️ Important Notes

- **MongoDB must be running** before importing
- **File paths** are relative to `services/mongo/`
- **mongoimport** must be installed (MongoDB Database Tools)
- **CSV files** in `datasets/5000/`, `datasets/10000/`, `datasets/25000/`
- **Departments** collection is shared across all sizes (loaded once)

---

## 🎯 Result

MongoDB now:
- Uses **integer IDs matching PostgreSQL**
- Supports **direct CSV import**
- Works with **k6 benchmarking**
- Enables **fair performance comparison**
- Maintains **identical data structure**

Ready for production comparison testing! 🚀
