// import http from 'k6/http';
// import { check, sleep } from 'k6';

// export const options = { //different params that we can play with.
//   stages: [
//     { duration: '30s', target: 20 },
//     { duration: '1m', target: 20 },  
//     { duration: '20s', target: 0 }, 
//   ],
//   thresholds: {
//     http_req_duration: ['p(95)<200', 'p(99)<500'], // Thresholds - criteria for pass or fail.
//   },
// };

// export default function () { // entry point to the script.
//   const params = { headers: { 'Content-Type': 'application/json' } };
  
//   // Test Postgres Path
//   const pgRes = http.get('http://gateway:3000/api/patients?db=postgres', params);
//   check(pgRes, { 'PG status 200': (r) => r.status === 200 });

//   // Test Mongo Path
//   const mongoRes = http.get('http://gateway:3000/api/patients?db=mongo', params);
//   check(mongoRes, { 'Mongo status 200': (r) => r.status === 200 });

//   sleep(1); // to simulate real world scenario.
// }

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up
    { duration: '1m', target: 50 },  // Heavy load
    { duration: '20s', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<600'], // Transactions take longer than simple gets
    http_req_failed: ['rate<0.01'],               // Error rate < 1%
  },
};

// Simulate a pool of existing IDs to avoid "Hot Key" database locking
const data = new SharedArray('users', function () {
  return Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
});

// Test both databases
const databases = ['postgres', 'mongo'];

export default function () {
  const url = 'http://localhost:9000/gateway';
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '1',
      'x-username': 'k6-runner',
      'x-user-role': 'superadmin'
    }
  };
  
  // Pick a random database to test
  const db = databases[Math.floor(Math.random() * databases.length)];
  const dbSize = '5k';
  
  // Pick a random ID from our pool
  const randomUser = data[Math.floor(Math.random() * data.length)];
  const randomDepartmentId = Math.floor(Math.random() * 4) + 1;

  
  // --- 1. HEAVY READ: Get Patient Profile & History ---
  // This tests the JOIN logic
  const getRes = http.get(`${url}/patients/${randomUser.id}?db=${db}&db_size=${dbSize}`, params);
  check(getRes, { [`Get Patient ${db} status 200`]: (r) => r.status === 200 });

  sleep(1);

  // --- 2. WRITE: Add Doctor Profile (with new schema) ---
  const doctorPayload = JSON.stringify({
    first_name: 'Dr. Test',
    last_name: 'Doctor',
    specialization: 'Cardiology',
    phone_number: '555-0100',
    email: `doctor-${__VU}-${__ITER}-${db}@test.com`,
    department_id: randomDepartmentId
  });

  const doctorRes = http.post(`${url}/doctors?db=${db}&db_size=${dbSize}`, doctorPayload, params);
  const doctorData = doctorRes.json();
  check(doctorRes, { [`Add Doctor ${db} status 201`]: (r) => r.status === 201 });

  sleep(0.5);

  // --- 3. WRITE: Add Appointment ---
  // Testing connection pool limits
  const appointmentPayload = JSON.stringify({
    patient_id: randomUser.id,
    doctor_id: doctorData.doctor_id,
    appointment_date: '2026-05-20',
    appointment_time: '10:00:00',
    reason_for_visit: 'K6 Performance Test'
  });

  const apptRes = http.post(`${url}/appointments?db=${db}&db_size=${dbSize}`, appointmentPayload, params);
  const apptData = apptRes.json();
  check(apptRes, { [`Add Appt ${db} status 201`]: (r) => r.status === 201 });

  // --- 4. HEAVY TRANSACTION: Complete Checkout ---
  // This is the P0 target. Only run if we have a valid appointment_id from step 3
  const appointmentId = apptData.appointment_id || apptData._id;

if (apptData && appointmentId) {
    const checkoutPayload = JSON.stringify({
        appointment_id: appointmentId,
        medication_name: 'Amoxicillin',
        dosage: '500mg',
        consultation_fee: 50.00,
        medicine_charges: 20.00,
        lab_charges: 0.00,
        payment_method: 'Card'
    });

    const checkoutRes = http.post(`${url}/appointments/complete-checkout?db=${db}&db_size=${dbSize}`, checkoutPayload, params);
    check(checkoutRes, { [`Checkout ${db} status 200`]: (r) => r.status === 200 });
  }

  // --- 5. ANALYTICAL READ: Revenue Report ---
  // Hit this less frequently to simulate admin usage
  if (Math.random() < 0.1) {
    const reportRes = http.get(`${url}/analytics/revenue-report?db=${db}&db_size=${dbSize}`, params);
    check(reportRes, { [`Report ${db} status 200`]: (r) => r.status === 200 });
  }

  // --- 6. ANALYTICAL READ: Doctor Workload ---
  // Hit this to verify doctor-workload with new schema
  if (Math.random() < 0.1) {
    const workloadRes = http.get(`${url}/analytics/doctor-workload?db=${db}&db_size=${dbSize}`, params);
    check(workloadRes, { [`Workload ${db} status 200`]: (r) => r.status === 200 });
  }

  sleep(2); // Think time between "patients"
}
