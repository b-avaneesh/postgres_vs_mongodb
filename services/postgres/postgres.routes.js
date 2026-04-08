const express = require('express');
const router = express.Router();
const {
    addPatient,
    addDoctor,
    addAppointment,
    getPatient,
    updateAppointment,
    deletePatient,
    revenueReport,
    doctorWorkload,
    medicationTrends,
    seedData,
    resetDatabase,
    completeCheckout
} = require('./postgres.controller');

// ============= Primary Endpoints =============

// POST /patients - Add a new patient record
router.post('/patients', addPatient);

// POST /doctors - Add a new doctor profile
router.post('/doctors', addDoctor);

// POST /appointments - Book a new appointment
router.post('/appointments', addAppointment);

// GET /patients/:id - Retrieve a specific patient's profile and history
router.get('/patients/:id', getPatient);

// PUT /appointments/:id - Update appointment status
router.put('/appointments/:id', updateAppointment);

// DELETE /patients/:id - Remove a patient and associated records
router.delete('/patients/:id', deletePatient);

// ============= Analytical Endpoints =============

// GET /analytics/revenue-report - Revenue reports by doctor or department
router.get('/analytics/revenue-report', revenueReport);

// GET /analytics/doctor-workload - Patient counts per doctor
router.get('/analytics/doctor-workload', doctorWorkload);

// GET /analytics/medication-trends - Medication frequency analysis
router.get('/analytics/medication-trends', medicationTrends);

// ============= System Endpoints =============

// POST /system/seed - Triggers bulk-load data (e.g., ?count=5000)
router.post('/system/seed', seedData);

// POST /system/reset - Clears the database
router.post('/system/reset', resetDatabase);

// ============= Transactional Endpoint =============

// POST /appointments/complete-checkout - Mark done, issue prescription, create bill
router.post('/appointments/complete-checkout/', completeCheckout);


const { register } = require('./postgres.metric'); // Import the registry you created
router.get('/metrics', async (req, res) => {
  try {
    // 1. Set the correct header for Prometheus (text/plain; version=0.0.4)
    res.set('Content-Type', register.contentType);

    // 2. Send the metrics data as a string
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = router;
