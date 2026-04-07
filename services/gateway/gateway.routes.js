const express = require('express')
const path = require('path')
require('dotenv').config({
    path : path.resolve(__dirname,'.env')
})
const { routingMiddleware, endpointInfo } = require("./gateway.controller")

const router = express.Router();

// ============= Primary Endpoints =============

/**
 * POST /patients - Add a new patient record
 */
router.post('/patients', routingMiddleware);

/**
 * POST /doctors - Add a new doctor profile
 */
router.post('/doctors', routingMiddleware);

/**
 * POST /appointments - Book a new appointment
 */
router.post('/appointments', routingMiddleware);

/**
 * GET /patients/:id - Retrieve a specific patient's profile and history
 */
router.get('/patients/:id', routingMiddleware);

/**
 * PUT /appointments/:id - Update appointment status
 */
router.put('/appointments/:id', routingMiddleware);

/**
 * DELETE /patients/:id - Remove a patient and associated records
 */
router.delete('/patients/:id', routingMiddleware);

// ============= Analytical Endpoints =============

/**
 * GET /analytics/revenue-report - Generates revenue reports by doctor or department
 */
router.get('/analytics/revenue-report', routingMiddleware);

/**
 * GET /analytics/doctor-workload - Returns patient counts per doctor
 */
router.get('/analytics/doctor-workload', routingMiddleware);

/**
 * GET /analytics/medication-trends - Analyzes the frequency of specific prescriptions
 */
router.get('/analytics/medication-trends', routingMiddleware);

// ============= System Endpoints =============

/**
 * POST /system/seed - Triggers bulk-load data (e.g., ?count=5000)
 */
router.post('/system/seed', routingMiddleware);

/**
 * POST /system/reset - Clears the database
 */
router.post('/system/reset', routingMiddleware);

// ============= Transactional Endpoint =============

/**
 * POST /appointments/complete-checkout - Mark done, issue prescription, create bill
 */
router.post('/appointments/complete-checkout', routingMiddleware);

router.get('/apiinfo',endpointInfo);

module.exports = router;
