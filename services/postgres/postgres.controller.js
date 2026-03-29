const db = require('./get-client.postgres');

// ============= PRIMARY ENDPOINTS =============

/**
 * POST /patients - Add a new patient record
 */
async function addPatient(req, res) {
    try {
        const { first_name, last_name, date_of_birth, gender, phone_number, email, address } = req.body;

        const query = `
            INSERT INTO patients (first_name, last_name, date_of_birth, gender, phone_number, email, address)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;

        const result = await db.query(query, [first_name, last_name, date_of_birth, gender, phone_number, email, address]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding patient:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * POST /doctors - Add a new doctor profile
 */
async function addDoctor(req, res) {
    try {
        const { first_name, last_name, specialization, phone_number, email, department } = req.body;

        const query = `
            INSERT INTO doctors (first_name, last_name, specialization, phone_number, email, department)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;

        const result = await db.query(query, [first_name, last_name, specialization, phone_number, email, department]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding doctor:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * POST /appointments - Book a new appointment
 */
async function addAppointment(req, res) {
    try {
        const { patient_id, doctor_id, appointment_date, appointment_time, status } = req.body;

        const query = `
            INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;

        const result = await db.query(query, [patient_id, doctor_id, appointment_date, appointment_time, status || 'Scheduled']);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding appointment:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * GET /patients/:id - Retrieve a specific patient's profile and history
 */
async function getPatient(req, res) {
    try {
        const { id } = req.params;

        const query = `
            SELECT p.*,
                   json_agg(json_build_object(
                       'appointment_id', a.appointment_id,
                       'doctor_name', CONCAT(d.first_name, ' ', d.last_name),
                       'appointment_date', a.appointment_date,
                       'status', a.status
                   )) as appointments
            FROM patients p
            LEFT JOIN appointments a ON p.patient_id = a.patient_id
            LEFT JOIN doctors d ON a.doctor_id = d.doctor_id
            WHERE p.patient_id = $1
            GROUP BY p.patient_id;
        `;

        const result = await db.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching patient:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * Will have to perform - get all appointments related to a user, then user picks on one of the appointments - extract appointment id.
 * PUT /appointments/:id - Update appointment status
 */
async function updateAppointment(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const query = `
            UPDATE appointments
            SET status = $1
            WHERE appointment_id = $2
            RETURNING *;
        `;

        const result = await db.query(query, [status, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error updating appointment:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * DELETE /patients/:id - Remove a patient and associated records
 */
async function deletePatient(req, res) {
    try {
        const { id } = req.params;

        // Delete appointments first (foreign key constraint)
        await db.query('DELETE FROM appointments WHERE patient_id = $1', [id]);

        // Delete prescriptions
        await db.query('DELETE FROM prescriptions WHERE patient_id = $1', [id]);

        // Delete bills
        await db.query('DELETE FROM bills WHERE patient_id = $1', [id]);

        // Delete patient
        const query = 'DELETE FROM patients WHERE patient_id = $1 RETURNING *;';
        const result = await db.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.status(200).json({ message: 'Patient deleted successfully', patient: result.rows[0] });
    } catch (err) {
        console.error('Error deleting patient:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ============= ANALYTICAL ENDPOINTS =============

/**
 * GET /analytics/revenue-report - Generates revenue reports by doctor or department
 */
async function revenueReport(req, res) {
    try {
        const { doctor_id, department } = req.query;

        let query = `
            SELECT
                d.doctor_id,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                d.department,
                COUNT(b.bill_id) as total_appointments,
                SUM(b.amount) as total_revenue
            FROM doctors d
            LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
            LEFT JOIN bills b ON a.appointment_id = b.appointment_id
        `;

        let params = [];
        let conditions = [];

        if (doctor_id) {
            conditions.push(`d.doctor_id = $${params.length + 1}`);
            params.push(doctor_id);
        }

        if (department) {
            conditions.push(`d.department = $${params.length + 1}`);
            params.push(department);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` GROUP BY d.doctor_id, d.first_name, d.last_name, d.department
                  ORDER BY total_revenue DESC;`;

        const result = await db.query(query, params);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error generating revenue report:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * GET /analytics/doctor-workload - Returns patient counts per doctor
 */
async function doctorWorkload(req, res) {
    try {
        const query = `
            SELECT
                d.doctor_id,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                d.specialization,
                COUNT(DISTINCT a.patient_id) as unique_patients,
                COUNT(a.appointment_id) as total_appointments,
                COUNT(CASE WHEN a.status = 'Completed' THEN 1 END) as completed_appointments,
                COUNT(CASE WHEN a.status = 'Scheduled' THEN 1 END) as scheduled_appointments
            FROM doctors d
            LEFT JOIN appointments a ON d.doctor_id = a.doctor_id
            GROUP BY d.doctor_id, d.first_name, d.last_name, d.specialization
            ORDER BY total_appointments DESC;
        `;

        const result = await db.query(query, []);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching doctor workload:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * GET /analytics/medication-trends - Analyzes the frequency of specific prescriptions
 */
async function medicationTrends(req, res) {
    try {
        const query = `
            SELECT
                medication_name,
                COUNT(*) as frequency,
                COUNT(DISTINCT p.patient_id) as unique_patients,
                COUNT(DISTINCT p.doctor_id) as unique_doctors
            FROM prescriptions p
            GROUP BY medication_name
            ORDER BY frequency DESC;
        `;

        const result = await db.query(query, []);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching medication trends:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ============= SYSTEM ENDPOINTS =============

/**
 * POST /system/seed - Triggers bulk-load data (e.g., ?count=5000)
 */
async function seedData(req, res) {
    try {
        const { count = 100 } = req.query;

        // This would typically trigger the faker script
        // For now, we'll return a success message indicating the count to seed
        res.status(202).json({
            message: `Seeding ${count} records initiated`,
            count: parseInt(count),
            status: 'In Progress'
        });
    } catch (err) {
        console.error('Error seeding data:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * POST /system/reset - Clears the database
 */
async function resetDatabase(req, res) {
    try {
        // Delete all data in reverse order of foreign key dependencies
        await db.query('DELETE FROM bills;');
        await db.query('DELETE FROM prescriptions;');
        await db.query('DELETE FROM appointments;');
        await db.query('DELETE FROM patients;');
        await db.query('DELETE FROM doctors;');

        res.status(200).json({ message: 'Database reset successfully' });
    } catch (err) {
        console.error('Error resetting database:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ============= TRANSACTIONAL ENDPOINT =============

/**
 * POST /appointments/complete-checkout - Mark appointment as done, issue prescription, create bill
 * This is an atomic transaction that combines multiple operations
 */
async function completeCheckout(req, res) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const { appointment_id, medication_name, dosage, amount } = req.body;

        // 1. Mark appointment as completed
        const appointmentQuery = `
            UPDATE appointments
            SET status = 'Completed'
            WHERE appointment_id = $1
            RETURNING *;
        `;
        const appointmentResult = await client.query(appointmentQuery, [appointment_id]);

        if (appointmentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Appointment not found' });
        }

        const appointment = appointmentResult.rows[0];

        // 2. Issue prescription
        const prescriptionQuery = `
            INSERT INTO prescriptions (appointment_id, patient_id, doctor_id, medication_name, dosage, issued_date)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *;
        `;
        const prescriptionResult = await client.query(prescriptionQuery, [
            appointment_id,
            appointment.patient_id,
            appointment.doctor_id,
            medication_name,
            dosage
        ]);

        // 3. Create bill
        const billQuery = `
            INSERT INTO bills (appointment_id, patient_id, amount, bill_date, status)
            VALUES ($1, $2, $3, NOW(), 'Pending')
            RETURNING *;
        `;
        const billResult = await client.query(billQuery, [appointment_id, appointment.patient_id, amount]);

        await client.query('COMMIT');

        res.status(200).json({
            appointment: appointmentResult.rows[0],
            prescription: prescriptionResult.rows[0],
            bill: billResult.rows[0]
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in complete checkout:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
}

// Placeholder for the old controller function
async function getRecord() {
    try {
        const res = await db.query('SELECT appointment_id from patients_5k join appointments_5k on patients_5k.patient_id = appointments_5k.patient_id join doctors_5k on doctors_5k.doctor_id = appointments_5k.doctor_id LIMIT 10;')
        if (res.rows.length > 0) {
            console.log("Record Found:", res.rows);
            return res.rows;
        } else {
            console.log("No records found in table.");
        }
    } catch (err) {
        console.error("Query Error:", err.message);
    }
}

module.exports = {
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
    completeCheckout,
    getRecord // Keep for backward compatibility
};
