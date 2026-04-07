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

export default function () {
  const url = 'http://localhost:9000/gateway';
  const params = { headers: { 'Content-Type': 'application/json' } };
  
  // Pick a random ID from our pool
  const randomUser = data[Math.floor(Math.random() * data.length)];

  // --- 1. HEAVY READ: Get Patient Profile & History ---
  // This tests the JSON_AGG and JOIN logic
  const getRes = http.get(`${url}/patients/${randomUser.id}?db=postgres&db_size=5k`, params);
  check(getRes, { 'Get Patient status 200': (r) => r.status === 200 });

  sleep(1);

  // --- 2. WRITE: Add Appointment ---
  // Testing connection pool limits
  const appointmentPayload = JSON.stringify({
    patient_id: randomUser.id,
    doctor_id: Math.floor(Math.random() * 10) + 1,
    appointment_date: '2026-05-20',
    appointment_time: '10:00:00',
    reason_for_visit: 'K6 Performance Test'
  });

  const apptRes = http.post(`${url}/appointments?db=postgres&db_size=5k`, appointmentPayload, params);
  const apptData = apptRes.json();
  check(apptRes, { 'Add Appt status 201': (r) => r.status === 201 }); //works till here

  // --- 3. HEAVY TRANSACTION: Complete Checkout ---
  // This is the P0 target. Only run if we have a valid appointment_id from step 2
  if (apptData && apptData.appointment_id) {
    // Inside your k6 script
    const checkoutPayload = JSON.stringify({
        appointment_id: apptData.appointment_id,
        medication_name: 'Amoxicillin',
        dosage: '500mg',
        consultation_fee: 50.00,   // Match these keys
        medicine_charges: 20.00,   // Match these keys
        lab_charges: 0.00,         // Match these keys
        payment_method: 'Card'
    });

    const checkoutRes = http.post(`${url}/appointments/complete-checkout?db=postgres&db_size=5k`, checkoutPayload, params);
    check(checkoutRes, { 'Checkout status 200': (r) => r.status === 200 });
  }

  // --- 4. ANALYTICAL READ: Revenue Report ---
  // Hit this less frequently (e.g., 10% of the time) to simulate admin usage
  if (Math.random() < 0.1) {
    const reportRes = http.get(`${url}/analytics/revenue-report?db=postgres&db_size=5k`, params);
    check(reportRes, { 'Report status 200': (r) => r.status === 200 });
  }

  sleep(2); // Think time between "patients"
}