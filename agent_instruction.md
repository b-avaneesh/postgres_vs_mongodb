# 🏥 Healthcare System – Agent Guide

## 📌 Overview

This project implements a **dual-database healthcare system** using:

* **PostgreSQL (Relational)**
* **MongoDB (NoSQL)**

Both databases are exposed through a **unified API layer**, allowing:

* Runtime switching between DBs
* Performance benchmarking (k6)
* Monitoring (Prometheus + Grafana)

---

## 🧱 Architecture

```
Client (k6 / Postman)
        ↓
   API Gateway
        ↓
-------------------------
| PostgreSQL Controller |
| MongoDB Controller    |
-------------------------
        ↓
PostgreSQL DB     MongoDB
```

---

## 🔀 Database Switching

All endpoints accept:

```
?db=postgres | mongo
?db_size=5k | 10k | 25k
```

Example:

```
GET /patients/1?db=mongo&db_size=5k
```

---

## 🧩 Data Modeling Strategy

### PostgreSQL (Normalized)

* `patients`
* `doctors`
* `departments`
* `doctor_specializations`
* `appointments`
* `prescriptions`
* `billing`

✔ Fully normalized (3NF)
✔ Foreign keys enforced

---

### MongoDB (Relational Simulation)

Mongo mirrors SQL structure using:

* Numeric IDs (`doctor_id`, `patient_id`, etc.)
* Separate collections (no embedding)
* `$lookup` for joins

✔ Ensures fair comparison with PostgreSQL
✔ Avoids Mongo-native denormalization advantage

---

## 🔑 Key Design Decisions

### 1. Numeric IDs Instead of ObjectId

Mongo uses:

```
doctor_id: Number
```

NOT:

```
_id: ObjectId
```

Reason:

* Align with PostgreSQL
* Enable valid benchmarking
* Ensure consistent joins

---

### 2. Dynamic Collections (Dataset Scaling)

Collections are suffixed:

```
patients_5k
patients_10k
patients_25k
```

Handled via:

```js
getCollectionName(base, db_size)
```

---

### 3. Relationship Handling (Mongo)

Simulated via `$lookup`:

Example:

```js
$lookup: {
  from: 'appointments_5k',
  localField: 'doctor_id',
  foreignField: 'doctor_id',
  as: 'appointments'
}
```

---

### 4. Transactions (Mongo)

Used in:

```
POST /appointments/complete-checkout
```

Flow:

1. Update appointment → Completed
2. Insert prescription
3. Insert bill

All wrapped in:

```js
session.startTransaction()
```

---

## 🚀 Core API Endpoints

### 👤 Patients

* `POST /patients`
* `GET /patients/:id`
* `DELETE /patients/:id`

---

### 👨‍⚕️ Doctors

* `POST /doctors`

---

### 📅 Appointments

* `POST /appointments`
* `PUT /appointments/:id`

---

### 💳 Checkout (Transactional)

* `POST /appointments/complete-checkout`

---

### 📊 Analytics

#### Revenue Report

```
GET /analytics/revenue-report
```

Returns:

* doctor_id
* doctor_name
* department_name
* total_appointments
* total_revenue

---

#### Doctor Workload

```
GET /analytics/doctor-workload
```

Returns:

* total_appointments
* unique_patients
* completed vs scheduled

---

## 📈 Benchmarking (k6)

Simulates real workload:

### Flow:

1. Get Patient (READ)
2. Add Doctor (WRITE)
3. Add Appointment (WRITE)
4. Checkout (TRANSACTION)
5. Revenue Report (ANALYTICS)
6. Doctor Workload (ANALYTICS)

---

### Key Features:

* Random DB selection (Postgres vs Mongo)
* Mixed workload (read/write/analytics)
* Avoids hot keys using SharedArray
* Threshold-based validation

---

## 📊 Monitoring

### Prometheus

* Collects metrics via:

  * postgres_exporter
  * mongodb_exporter
  * custom app metrics

### Grafana

* Visualizes:

  * latency
  * throughput
  * DB performance

---

## ⚠️ Important Constraints

* Mongo MUST use numeric IDs (no ObjectId joins)
* Schema must match PostgreSQL logically
* No denormalization in Mongo (for fair comparison)
* All aggregations must mirror SQL queries

---

## 🧪 Data Generation

Synthetic data generated using:

```
faker_postgres.js
```

Then:

* Loaded into Postgres via COPY
* Loaded into Mongo via mongoimport

---

## 🧠 Key Takeaway

This project is NOT just CRUD.

It demonstrates:

* Relational vs NoSQL tradeoffs
* Schema normalization vs flexibility
* Query performance under load
* Real-world system design

---

## ✅ Final Status

* ✔ Dual DB system working
* ✔ APIs consistent
* ✔ Transactions implemented
* ✔ Analytics validated
* ✔ Benchmark ready

---

## 🏁 How to Run

1. Start services (Docker)
2. Load data (CSV → DB)
3. Start backend
4. Run k6 script
5. View metrics in Grafana

---

## 🚀 End

System is fully operational and benchmark-ready.
