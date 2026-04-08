const db = require('./get-client.postgres');
// const { pool, query } = require('./get-client.postgres')
const {  register,
  dbQueryTimer} = require('./postgres.metric')
// Helper functions
function getTableName(base, db_size) {
    return `${base}_${db_size}`;
}

function getPatientId(req) {
 return req.user?.id || 
           req.body?.patient_id || 
           req.params?.patient_id || 
           req.params?.id; // This is the one hitting '100' in your logs
}


// ============= PRIMARY ENDPOINTS =============

/**
 * POST /patients - Add a new patient record
 */
// async function explainAnalyze(query, params){
//     const prefix = `EXPLAIN (ANALYZE, BUFFERS) `;
//     const final_query = prefix+query;
//     const res = await db.query(final_query, params);
//     console.log(res);

// };

async function addPatient(req, res) {
    try {
        const db_size = req.query.db_size || '5k';
        const patients_table = getTableName('patients', db_size);
        const { first_name, last_name, date_of_birth, gender, phone_number, email, address } = req.body;

        const query = `
            INSERT INTO ${patients_table} (first_name, last_name, date_of_birth, gender, phone_number, email, address)
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
        const db_size = req.query.db_size || '5k';
        const doctors_table = getTableName('doctors', db_size);
        const spec_table = getTableName('doctor_specializations', db_size);

        const { first_name, last_name, specialization, phone_number, email, department_id } = req.body;

        // 1. Insert into doctors (NO specialization, NO department string)
        const doctorQuery = `
            INSERT INTO ${doctors_table} 
            (first_name, last_name, phone, email, department_id)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;

        const doctorResult = await db.query(doctorQuery, [
            first_name,
            last_name,
            phone_number,
            email,
            department_id
        ]);

        const doctor = doctorResult.rows[0];

        // 2. Insert specialization separately (KEY FIX)
        if (specialization) {
            const specQuery = `
                INSERT INTO ${spec_table} (doctor_id, specialization)
                VALUES ($1, $2);
            `;
            await db.query(specQuery, [doctor.doctor_id, specialization]);
        }

        res.status(201).json(doctor);

    } catch (err) {
        console.error('Error adding doctor:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * POST /appointments - Book a new appointment
 */
async function addAppointment(req, res) {
    const end = dbQueryTimer.startTimer({ operation: 'add_appointment' });

    try {
        const db_size = req.query.db_size || '5k';
        const appointments_table = getTableName('appointments', db_size);
        const patients_table = getTableName('patients', db_size);
        const doctors_table = getTableName('doctors', db_size);
        const { patient_id, doctor_id, appointment_date, appointment_time, status } = req.body;

        const query = `
            INSERT INTO ${appointments_table} (patient_id, doctor_id, appointment_date, appointment_time, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;

        const result = await db.query(query, [patient_id, doctor_id, appointment_date, appointment_time, status || 'Scheduled']);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding appointment:', err.message);
        res.status(500).json({ error: err.message });
    }finally{
        end();
    }
}

/**
 * GET /patients/:id - Retrieve a specific patient's profile and history
 */
async function getPatient(req, res) {
    const end = dbQueryTimer.startTimer({ operation: 'get_patient' });

    try {
        const db_size = req.query.db_size || '5k';
        const patients_table = getTableName('patients', db_size);
        const appointments_table = getTableName('appointments', db_size);
        const doctors_table = getTableName('doctors', db_size);
        const patient_id = getPatientId(req);

        const query = `
            SELECT p.*,
                   json_agg(json_build_object(
                       'appointment_id', a.appointment_id,
                       'doctor_name', CONCAT(d.first_name, ' ', d.last_name),
                       'appointment_date', a.appointment_date,
                       'status', a.status
                   )) as appointments
            FROM ${patients_table} p
            LEFT JOIN ${appointments_table} a ON p.patient_id = a.patient_id
            LEFT JOIN ${doctors_table} d ON a.doctor_id = d.doctor_id
            WHERE p.patient_id = $1
            GROUP BY p.patient_id;
        `;

        const result = await db.query(query, [patient_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching patient:', err.message);
        res.status(500).json({ error: err.message });
    }finally{
        end();
    }
}

/**
 * Will have to perform - get all appointments related to a user, then user picks on one of the appointments - extract appointment id.
 * PUT /appointments/:id - Update appointment status
 */
async function updateAppointment(req, res) {
    try {
        const db_size = req.query.db_size || '5k';
        const appointments_table = getTableName('appointments', db_size);
        const { id } = req.params;
        const { status } = req.body;

        const query = `
            UPDATE ${appointments_table}
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
        const db_size = req.query.db_size || '5k';
        const patients_table = getTableName('patients', db_size);
        const appointments_table = getTableName('appointments', db_size);
        const prescriptions_table = getTableName('prescriptions', db_size);
        const bills_table = getTableName('billing', db_size);
        const patient_id = getPatientId(req);

        // Delete appointments first (foreign key constraint)
        await db.query(`DELETE FROM ${appointments_table} WHERE patient_id = $1`, [patient_id]);

        // Delete prescriptions
        await db.query(`DELETE FROM ${prescriptions_table} WHERE patient_id = $1`, [patient_id]);

        // Delete billing
        await db.query(`DELETE FROM ${bills_table} WHERE patient_id = $1`, [patient_id]);

        // Delete patient
        const query = `DELETE FROM ${patients_table} WHERE patient_id = $1 RETURNING *;`;
        const result = await db.query(query, [patient_id]);

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
    const end = dbQueryTimer.startTimer({ operation: 'revenue_report' });

    try {
        const db_size = req.query.db_size || '5k';

        const doctors_table = getTableName('doctors', db_size);
        const appointments_table = getTableName('appointments', db_size);
        const bills_table = getTableName('billing', db_size);

        const dept_table = 'departments'; // shared table

        const { doctor_id, department } = req.body;

        let query = `
            SELECT
                d.doctor_id,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                dep.department_name,
                COUNT(b.bill_id) as total_appointments,
                COALESCE(SUM(b.consultation_fee), 0) as total_revenue
            FROM ${doctors_table} d
            LEFT JOIN ${dept_table} dep 
                ON d.department_id = dep.department_id
            LEFT JOIN ${appointments_table} a 
                ON d.doctor_id = a.doctor_id
            LEFT JOIN ${bills_table} b 
                ON a.appointment_id = b.appointment_id
        `;

        let params = [];
        let conditions = [];

        // filter by doctor
        if (doctor_id) {
            conditions.push(`d.doctor_id = $${params.length + 1}`);
            params.push(doctor_id);
        }

        // filter by department name (normalized now)
        if (department) {
            conditions.push(`dep.department_name = $${params.length + 1}`);
            params.push(department);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += `
            GROUP BY d.doctor_id, d.first_name, d.last_name, dep.department_name
            ORDER BY total_revenue DESC;
        `;

        const result = await db.query(query, params);
        res.status(200).json(result.rows);

    } catch (err) {
        console.error('Error generating revenue report:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        end();
    }
}

/**
 * GET /analytics/doctor-workload - Returns patient counts per doctor
 */
async function doctorWorkload(req, res) {
    try {
        const db_size = req.query.db_size || '5k';
        const doctors_table = getTableName('doctors', db_size);
        const appointments_table = getTableName('appointments', db_size);
        const query = `
            SELECT
                d.doctor_id,
                CONCAT(d.first_name, ' ', d.last_name) as doctor_name,
                d.specialization,
                COUNT(DISTINCT a.patient_id) as unique_patients,
                COUNT(a.appointment_id) as total_appointments,
                COUNT(CASE WHEN a.status = 'Completed' THEN 1 END) as completed_appointments,
                COUNT(CASE WHEN a.status = 'Scheduled' THEN 1 END) as scheduled_appointments
            FROM ${doctors_table} d
            LEFT JOIN ${appointments_table} a ON d.doctor_id = a.doctor_id
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
        const db_size = req.query.db_size || '5k';
        const prescriptions_table = getTableName('prescriptions', db_size);
        const query = `
            SELECT
                medication_name,
                COUNT(*) as frequency,
                COUNT(DISTINCT p.patient_id) as unique_patients,
                COUNT(DISTINCT p.doctor_id) as unique_doctors
            FROM ${prescriptions_table} p
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
        const db_size = req.query.db_size || '5k';
        const bills_table = getTableName('billing', db_size);
        const prescriptions_table = getTableName('prescriptions', db_size);
        const appointments_table = getTableName('appointments', db_size);
        const patients_table = getTableName('patients', db_size);
        const doctors_table = getTableName('doctors', db_size);
        // Delete all data in reverse order of foreign key dependencies
        await db.query(`DELETE FROM ${bills_table};`);
        await db.query(`DELETE FROM ${prescriptions_table};`);
        await db.query(`DELETE FROM ${appointments_table};`);
        await db.query(`DELETE FROM ${patients_table};`);
        await db.query(`DELETE FROM ${doctors_table};`);

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
    const end = dbQueryTimer.startTimer({ operation: 'complete_checkout' });
    try {
        // console.log("within compeltecheckout");
        // res.status(200).json({msg:"hmm seems to work till here"});
        const db_size = req.query.db_size || '5k';
        const appointments_table = getTableName('appointments', db_size);
        const prescriptions_table = getTableName('prescriptions', db_size);
        const billing_table = getTableName('billing', db_size); // Matches screenshot billing_5k

        await client.query('BEGIN');

        // Extracting fields sent from k6
        // Note: Defaulting charges to 0 if not provided to avoid NaN errors
        const { 
            appointment_id, 
            medication_name, 
            dosage, 
            consultation_fee = 50.00, 
            medicine_charges = 20.00, 
            lab_charges = 0.00,
            payment_method = 'Cash' 
        } = req.body;

        // 1. Mark appointment as completed
        const apptRes = await client.query(
            `UPDATE ${appointments_table} SET status = 'Completed' WHERE appointment_id = $1 RETURNING *;`,
            [appointment_id]
        );

        if (apptRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // 2. Issue prescription (Matches ER Diagram columns)
        await client.query(
            `INSERT INTO ${prescriptions_table} (appointment_id, medication_name, dosage, issued_date)
             VALUES ($1, $2, $3, NOW());`,
            [appointment_id, medication_name, dosage]
        );

        // 3. Create bill (Matches your billing_5k screenshot exactly)
        const total_amount = parseFloat(consultation_fee) + parseFloat(medicine_charges) + parseFloat(lab_charges);
        
        const billQuery = `
            INSERT INTO ${billing_table} 
            (appointment_id, consultation_fee, medicine_charges, lab_charges, total_amount, payment_status, payment_method, bill_date)
            VALUES ($1, $2, $3, $4, $5, 'Paid', $6, NOW())
            RETURNING *;
        `;
        const billResult = await client.query(billQuery, [
            appointment_id, 
            consultation_fee, 
            medicine_charges, 
            lab_charges, 
            total_amount, 
            payment_method
        ]);

        await client.query('COMMIT');
        res.status(200).json(billResult.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Checkout error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        end();
        client.release();
    }
}

// Placeholder for the old controller function
async function getRecord() {
    try {
        const db_size = req.query.db_size || '5k';
        const patients_table = getTableName('patients', db_size);
        const appointments_table = getTableName('appointments', db_size);
        const doctors_table = getTableName('doctors', db_size);
        const res = await db.query(`SELECT appointment_id from ${patients_table} 
            join ${appointments_table} on ${patients_table}.patient_id = ${appointments_table}.patient_id 
            join ${doctors_table} on ${doctors_table}.doctor_id = ${appointments_table}.doctor_id LIMIT 10;`)
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
