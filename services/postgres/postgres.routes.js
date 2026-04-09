const express = require('express');
const router = express.Router();
const {
    login,
    addPatient,
    getPatients,
    searchPatients,
    addDoctor,
    getDoctors,
    getDepartments,
    searchDoctors,
    checkDoctorAvailability,
    deleteDoctor,
    addAppointment,
    getAppointments,
    getPatient,
    updateAppointment,
    deleteAppointment,
    deletePatient,
    revenueReport,
    doctorWorkload,
    medicationTrends,
    getBilling,
    getBillingByAppointment,
    getPrescriptions,
    getPrescriptionByAppointment,
    seedData,
    resetDatabase,
    completeCheckout
} = require('./postgres.controller');
const { register } = require('./postgres.metric');
const {
    loadUserFromHeaders,
    requireAdmin,
    requireSuperadmin
} = require('./auth.middleware');

router.use(loadUserFromHeaders);

router.post('/login', login);

router.post('/patients', requireAdmin, addPatient);
router.get('/patients', requireAdmin, getPatients);
router.get('/patients/search', requireAdmin, searchPatients);
router.get('/patients/:id', requireAdmin, getPatient);
router.delete('/patients/:id', requireAdmin, deletePatient);

router.post('/doctors', requireSuperadmin, addDoctor);
router.get('/doctors', requireAdmin, getDoctors);
router.get('/doctors/search', requireAdmin, searchDoctors);
router.get('/doctors/:id/availability', requireAdmin, checkDoctorAvailability);
router.delete('/doctors/:id', requireSuperadmin, deleteDoctor);
router.get('/departments', requireAdmin, getDepartments);

router.post('/appointments', requireAdmin, addAppointment);
router.get('/appointments', requireAdmin, getAppointments);
router.put('/appointments/:id', requireAdmin, updateAppointment);
router.delete('/appointments/:id', requireAdmin, deleteAppointment);
router.post('/appointments/complete-checkout/', requireSuperadmin, completeCheckout);

router.get('/analytics/revenue-report', requireSuperadmin, revenueReport);
router.get('/analytics/doctor-workload', requireSuperadmin, doctorWorkload);
router.get('/analytics/medication-trends', requireSuperadmin, medicationTrends);

router.get('/billing', requireSuperadmin, getBilling);
router.get('/billing/:appointment_id', requireSuperadmin, getBillingByAppointment);

router.get('/prescriptions', requireSuperadmin, getPrescriptions);
router.get('/prescriptions/:appointment_id', requireSuperadmin, getPrescriptionByAppointment);

router.post('/system/seed', requireSuperadmin, seedData);
router.post('/system/reset', requireSuperadmin, resetDatabase);

router.get('/metrics', async (_req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        const metrics = await register.metrics();
        res.end(metrics);
    } catch (err) {
        res.status(500).send(err);
    }
});

module.exports = router;
