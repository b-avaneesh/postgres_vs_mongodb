const db = require('./get-client.postgres');
const { register, dbQueryTimer } = require('./postgres.metric');

const POSTGRES_DATASET = '5k';
const BOOK_APPOINTMENT_PROCEDURE = 'book_appointment_5k';
const CANCEL_APPOINTMENT_PROCEDURE = 'cancel_appointment_5k';
const COMPLETE_CHECKOUT_PROCEDURE = 'complete_checkout_5k';
const DOCTOR_REVENUE_FUNCTION = 'get_doctor_revenue_5k';
const DOCTOR_APPOINTMENT_COUNT_FUNCTION = 'get_doctor_appointment_count_5k';

function getTableName(base) {
    return `${base}_${POSTGRES_DATASET}`;
}

function getPatientId(req) {
    return req.user?.id ||
        req.body?.patient_id ||
        req.params?.patient_id ||
        req.params?.id;
}

async function login(req, res) {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const result = await db.query(
            `SELECT user_id, username, role
             FROM users
             WHERE username = $1
               AND password = crypt($2, password)
             LIMIT 1`,
            [username, password]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function addPatient(req, res) {
    try {
        const patients_table = getTableName('patients');
        const { first_name, last_name, date_of_birth, gender, email, address } = req.body;
        const phone = req.body.phone ?? req.body.phone_number ?? null;

        const result = await db.query(
            `INSERT INTO ${patients_table} (first_name, last_name, date_of_birth, gender, phone, email, address)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [first_name, last_name, date_of_birth, gender, phone, email, address]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding patient:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getPatients(req, res) {
    try {
        const patients_table = getTableName('patients');
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
        const offset = (page - 1) * limit;
        const { name, phone, email } = req.query;
        const params = [];
        const conditions = [];

        if (name) {
            params.push(`%${name}%`);
            conditions.push(`CONCAT(first_name, ' ', last_name) ILIKE $${params.length}`);
        }

        if (phone) {
            params.push(`%${phone}%`);
            conditions.push(`phone ILIKE $${params.length}`);
        }

        if (email) {
            params.push(`%${email}%`);
            conditions.push(`email ILIKE $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countResult = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM ${patients_table}
             ${whereClause}`,
            params
        );

        params.push(limit);
        params.push(offset);
        const result = await db.query(
            `SELECT *
             FROM ${patients_table}
             ${whereClause}
             ORDER BY patient_id ASC
             LIMIT $${params.length - 1}
             OFFSET $${params.length}`,
            params
        );

        res.status(200).json({
            items: result.rows,
            page,
            limit,
            total: countResult.rows[0].total
        });
    } catch (err) {
        console.error('Error fetching patients:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function searchPatients(req, res) {
    try {
        const patients_table = getTableName('patients');
        const appointments_table = getTableName('appointments');
        const { name, phone, email } = req.query;
        const params = [];
        const conditions = [];

        if (name) {
            params.push(`%${name}%`);
            conditions.push(`CONCAT(first_name, ' ', last_name) ILIKE $${params.length}`);
        }

        if (phone) {
            params.push(`%${phone}%`);
            conditions.push(`phone ILIKE $${params.length}`);
        }

        if (email) {
            params.push(`%${email}%`);
            conditions.push(`email ILIKE $${params.length}`);
        }

        if (conditions.length === 0) {
            return res.status(200).json([]);
        }

        const result = await db.query(
            `SELECT
                p.patient_id,
                p.first_name,
                p.last_name,
                p.phone,
                p.email,
                upcoming.appointment_date AS next_appointment_date,
                upcoming.appointment_time AS next_appointment_time
             FROM ${patients_table} p
             LEFT JOIN LATERAL (
                SELECT a.appointment_date, a.appointment_time
                FROM ${appointments_table} a
                WHERE a.patient_id = p.patient_id
                  AND LOWER(a.status) <> 'cancelled'
                  AND (a.appointment_date + a.appointment_time) >= NOW()
                ORDER BY a.appointment_date ASC, a.appointment_time ASC
                LIMIT 1
             ) upcoming ON TRUE
             WHERE ${conditions.join(' AND ')}
             ORDER BY p.first_name ASC, p.last_name ASC
             LIMIT 12`,
            params
        );

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error searching patients:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function addDoctor(req, res) {
    try {
        const doctors_table = getTableName('doctors');
        const spec_table = getTableName('doctor_specializations');
        const { first_name, last_name, specialization, email, department_id } = req.body;
        const phone = req.body.phone ?? req.body.phone_number ?? null;

        const doctorResult = await db.query(
            `INSERT INTO ${doctors_table} (first_name, last_name, phone, email, department_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [first_name, last_name, phone, email, department_id]
        );

        const doctor = doctorResult.rows[0];

        if (specialization) {
            await db.query(
                `INSERT INTO ${spec_table} (doctor_id, specialization)
                 VALUES ($1, $2)`,
                [doctor.doctor_id, specialization]
            );
        }

        res.status(201).json(doctor);
    } catch (err) {
        console.error('Error adding doctor:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getDoctors(req, res) {
    try {
        const doctors_table = getTableName('doctors');
        const spec_table = getTableName('doctor_specializations');
        const dept_table = 'departments';

        const result = await db.query(
            `SELECT
                d.*,
                ds.specialization,
                dep.department_name
             FROM ${doctors_table} d
             LEFT JOIN ${spec_table} ds ON d.doctor_id = ds.doctor_id
             LEFT JOIN ${dept_table} dep ON d.department_id = dep.department_id
             ORDER BY d.doctor_id ASC`
        );

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching doctors:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getDepartments(req, res) {
    try {
        const result = await db.query(
            `SELECT department_id, department_name
             FROM departments
             ORDER BY department_name ASC`
        );

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching departments:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function searchDoctors(req, res) {
    try {
        const doctors_table = getTableName('doctors');
        const spec_table = getTableName('doctor_specializations');
        const appointments_table = getTableName('appointments');
        const { name, department_id, appointment_date, appointment_time } = req.query;
        const params = [];
        const conditions = [];

        if (name) {
            params.push(`%${name}%`);
            conditions.push(`CONCAT(d.first_name, ' ', d.last_name) ILIKE $${params.length}`);
        }

        if (department_id) {
            params.push(Number(department_id));
            conditions.push(`d.department_id = $${params.length}`);
        }

        let availabilityJoin = '';
        let availabilitySelect = 'TRUE AS is_available';

        if (appointment_date && appointment_time) {
            params.push(appointment_date);
            const dateParam = `$${params.length}`;
            params.push(appointment_time);
            const timeParam = `$${params.length}`;

            availabilityJoin = `
                LEFT JOIN ${appointments_table} a
                  ON d.doctor_id = a.doctor_id
                 AND a.appointment_date = ${dateParam}
                 AND ABS(EXTRACT(EPOCH FROM ((a.appointment_date + a.appointment_time) - (${dateParam}::date + ${timeParam}::time)))) < 1800
                 AND LOWER(a.status) <> 'cancelled'
            `;

            availabilitySelect = 'CASE WHEN a.appointment_id IS NULL THEN TRUE ELSE FALSE END AS is_available';
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await db.query(
            `SELECT
                d.doctor_id,
                d.first_name,
                d.last_name,
                d.department_id,
                dep.department_name,
                ds.specialization,
                ${availabilitySelect}
             FROM ${doctors_table} d
             LEFT JOIN ${spec_table} ds ON d.doctor_id = ds.doctor_id
             LEFT JOIN departments dep ON d.department_id = dep.department_id
             ${availabilityJoin}
             ${whereClause}
             ORDER BY d.first_name ASC, d.last_name ASC
             LIMIT 12`,
            params
        );

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error searching doctors:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function checkDoctorAvailability(req, res) {
    try {
        const appointments_table = getTableName('appointments');
        const { id } = req.params;
        const { appointment_date, appointment_time } = req.query;

        if (!appointment_date || !appointment_time) {
            return res.status(400).json({ error: 'appointment_date and appointment_time are required' });
        }

        const result = await db.query(
            `SELECT
                COALESCE(
                    array_agg(TO_CHAR(appointment_time, 'HH24:MI') ORDER BY appointment_time)
                    FILTER (WHERE appointment_id IS NOT NULL),
                    ARRAY[]::TEXT[]
                ) AS booked_slots,
                BOOL_OR(
                    ABS(EXTRACT(EPOCH FROM ((appointment_date + appointment_time) - ($2::date + $3::time)))) < 1800
                ) AS has_conflict
             FROM ${appointments_table}
             WHERE doctor_id = $1
               AND appointment_date = $2
               AND LOWER(status) <> 'cancelled'`,
            [id, appointment_date, appointment_time]
        );

        res.status(200).json({
            doctor_id: Number(id),
            appointment_date,
            booked_slots: result.rows[0]?.booked_slots || [],
            is_available: !result.rows[0]?.has_conflict
        });
    } catch (err) {
        console.error('Error checking doctor availability:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function deleteDoctor(req, res) {
    try {
        const doctors_table = getTableName('doctors');
        const spec_table = getTableName('doctor_specializations');
        const { id } = req.params;

        await db.query(
            `DELETE FROM ${spec_table}
             WHERE doctor_id = $1`,
            [id]
        );

        const result = await db.query(
            `DELETE FROM ${doctors_table}
             WHERE doctor_id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        res.status(200).json({ message: 'Doctor deleted successfully', doctor: result.rows[0] });
    } catch (err) {
        console.error('Error deleting doctor:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function addAppointment(req, res) {
    const end = dbQueryTimer.startTimer({ operation: 'add_appointment' });

    try {
        const appointments_table = getTableName('appointments');
        const {
            patient_id,
            doctor_id,
            appointment_date,
            appointment_time,
            reason_for_visit,
            status
        } = req.body;

        await db.query(
            `CALL ${BOOK_APPOINTMENT_PROCEDURE}($1, $2, $3, $4, $5, $6)`,
            [
                patient_id,
                doctor_id,
                appointment_date,
                appointment_time,
                reason_for_visit || null,
                status || null
            ]
        );

        const result = await db.query(
            `SELECT *
             FROM ${appointments_table}
             WHERE patient_id = $1
               AND doctor_id = $2
               AND appointment_date = $3
               AND appointment_time = $4
             ORDER BY appointment_id DESC
             LIMIT 1`,
            [patient_id, doctor_id, appointment_date, appointment_time]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding appointment:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        end();
    }
}

async function getAppointments(req, res) {
    try {
        const appointments_table = getTableName('appointments');
        const patients_table = getTableName('patients');
        const doctors_table = getTableName('doctors');
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const offset = (page - 1) * limit;
        const { start_date, end_date, q } = req.query;

        let query = `
            SELECT
                a.*,
                CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
            FROM ${appointments_table} a
            LEFT JOIN ${patients_table} p ON a.patient_id = p.patient_id
            LEFT JOIN ${doctors_table} d ON a.doctor_id = d.doctor_id
        `;

        const params = [];
        const conditions = [];

        if (q) {
            params.push(`%${q}%`);
            conditions.push(`(
                CAST(a.appointment_id AS TEXT) ILIKE $${params.length}
                OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $${params.length}
                OR CONCAT(d.first_name, ' ', d.last_name) ILIKE $${params.length}
                OR COALESCE(a.status, '') ILIKE $${params.length}
                OR COALESCE(a.reason_for_visit, '') ILIKE $${params.length}
            )`);
        }

        if (start_date) {
            params.push(start_date);
            conditions.push(`a.appointment_date >= $${params.length}`);
        }

        if (end_date) {
            params.push(end_date);
            conditions.push(`a.appointment_date <= $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        const countResult = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM (${query}) AS appointment_rows`,
            params
        );

        const paginatedParams = [...params, limit, offset];
        query += `
            ORDER BY a.appointment_date ASC, a.appointment_time ASC
            LIMIT $${paginatedParams.length - 1}
            OFFSET $${paginatedParams.length}
        `;

        const result = await db.query(query, paginatedParams);
        res.status(200).json({
            items: result.rows,
            page,
            limit,
            total: countResult.rows[0].total
        });
    } catch (err) {
        console.error('Error fetching appointments:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getPatient(req, res) {
    const end = dbQueryTimer.startTimer({ operation: 'get_patient' });

    try {
        const patients_table = getTableName('patients');
        const appointments_table = getTableName('appointments');
        const doctors_table = getTableName('doctors');
        const patient_id = getPatientId(req);

        const result = await db.query(
            `SELECT p.*,
                    json_agg(json_build_object(
                        'appointment_id', a.appointment_id,
                        'doctor_name', CONCAT(d.first_name, ' ', d.last_name),
                        'appointment_date', a.appointment_date,
                        'appointment_time', a.appointment_time,
                        'status', a.status
                    )) AS appointments
             FROM ${patients_table} p
             LEFT JOIN ${appointments_table} a ON p.patient_id = a.patient_id
             LEFT JOIN ${doctors_table} d ON a.doctor_id = d.doctor_id
             WHERE p.patient_id = $1
             GROUP BY p.patient_id`,
            [patient_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching patient:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        end();
    }
}

async function updateAppointment(req, res) {
    try {
        const appointments_table = getTableName('appointments');
        const { id } = req.params;
        const { status } = req.body;
        const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : status;

        if (normalizedStatus === 'cancelled') {
            await db.query(`CALL ${CANCEL_APPOINTMENT_PROCEDURE}($1)`, [id]);

            const cancelledResult = await db.query(
                `SELECT * FROM ${appointments_table} WHERE appointment_id = $1`,
                [id]
            );

            if (cancelledResult.rows.length === 0) {
                return res.status(404).json({ error: 'Appointment not found' });
            }

            return res.status(200).json(cancelledResult.rows[0]);
        }

        const result = await db.query(
            `UPDATE ${appointments_table}
             SET status = $1
             WHERE appointment_id = $2
             RETURNING *`,
            [normalizedStatus, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error updating appointment:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function deleteAppointment(req, res) {
    try {
        const appointments_table = getTableName('appointments');
        const prescriptions_table = getTableName('prescriptions');
        const billing_table = getTableName('billing');
        const { id } = req.params;

        const appointmentResult = await db.query(
            `SELECT *
             FROM ${appointments_table}
             WHERE appointment_id = $1`,
            [id]
        );

        if (appointmentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        await db.query(`DELETE FROM ${billing_table} WHERE appointment_id = $1`, [id]);
        await db.query(`DELETE FROM ${prescriptions_table} WHERE appointment_id = $1`, [id]);

        const result = await db.query(
            `DELETE FROM ${appointments_table}
             WHERE appointment_id = $1
             RETURNING *`,
            [id]
        );

        res.status(200).json({
            message: 'Appointment deleted successfully',
            appointment: result.rows[0]
        });
    } catch (err) {
        console.error('Error deleting appointment:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function deletePatient(req, res) {
    try {
        const patients_table = getTableName('patients');
        const patient_id = getPatientId(req);

        const result = await db.query(
            `DELETE FROM ${patients_table}
             WHERE patient_id = $1
             RETURNING *`,
            [patient_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.status(200).json({ message: 'Patient deleted successfully', patient: result.rows[0] });
    } catch (err) {
        console.error('Error deleting patient:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function revenueReport(req, res) {
    const end = dbQueryTimer.startTimer({ operation: 'revenue_report' });

    try {
        const doctors_table = getTableName('doctors');
        const dept_table = 'departments';
        const appointments_table = getTableName('appointments');
        const billing_table = getTableName('billing');
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const offset = (page - 1) * limit;
        const { doctor_id, department, start_date, end_date } = req.query;

        const baseQuery = `
            SELECT
                d.doctor_id,
                CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
                dep.department_name,
                COUNT(b.bill_id) FILTER (WHERE b.bill_id IS NOT NULL) AS total_appointments,
                COALESCE(SUM(b.total_amount), 0) AS total_revenue
            FROM ${doctors_table} d
            LEFT JOIN ${dept_table} dep ON d.department_id = dep.department_id
            LEFT JOIN ${appointments_table} a ON d.doctor_id = a.doctor_id
            LEFT JOIN ${billing_table} b ON a.appointment_id = b.appointment_id
        `;

        const params = [];
        const conditions = [];

        if (doctor_id) {
            params.push(doctor_id);
            conditions.push(`d.doctor_id = $${params.length}`);
        }

        if (department) {
            params.push(`%${department}%`);
            conditions.push(`dep.department_name ILIKE $${params.length}`);
        }

        if (start_date) {
            params.push(start_date);
            conditions.push(`DATE(b.bill_date) >= $${params.length}`);
        }

        if (end_date) {
            params.push(end_date);
            conditions.push(`DATE(b.bill_date) <= $${params.length}`);
        }

        const queryWhere = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
        const groupedQuery = `
            ${baseQuery}
            ${queryWhere}
            GROUP BY d.doctor_id, d.first_name, d.last_name, dep.department_name
        `;

        const countResult = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM (${groupedQuery}) AS revenue_rows`,
            params
        );

        const paginatedParams = [...params, limit, offset];
        const result = await db.query(
            `
            ${groupedQuery}
            ORDER BY total_revenue DESC
            LIMIT $${paginatedParams.length - 1}
            OFFSET $${paginatedParams.length}
            `,
            paginatedParams
        );

        res.status(200).json({
            items: result.rows,
            page,
            limit,
            total: countResult.rows[0].total
        });
    } catch (err) {
        console.error('Error generating revenue report:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        end();
    }
}

async function doctorWorkload(req, res) {
    try {
        const doctors_table = getTableName('doctors');
        const appointments_table = getTableName('appointments');
        const spec_table = getTableName('doctor_specializations');
        const dept_table = 'departments';
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const offset = (page - 1) * limit;
        const { department, doctor_name, start_date, end_date } = req.query;
        const params = [];
        const conditions = [];

        if (department) {
            params.push(`%${department}%`);
            conditions.push(`dep.department_name ILIKE $${params.length}`);
        }

        if (doctor_name) {
            params.push(`%${doctor_name}%`);
            conditions.push(`CONCAT(d.first_name, ' ', d.last_name) ILIKE $${params.length}`);
        }

        if (start_date) {
            params.push(start_date);
            conditions.push(`a.appointment_date >= $${params.length}`);
        }

        if (end_date) {
            params.push(end_date);
            conditions.push(`a.appointment_date <= $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const groupedQuery = `
            SELECT
                d.doctor_id,
                CONCAT(d.first_name, ' ', d.last_name) AS doctor_name,
                dep.department_name,
                ds.specialization,
                COUNT(DISTINCT a.patient_id) AS unique_patients,
                COUNT(a.appointment_id) AS total_appointments,
                COUNT(CASE WHEN LOWER(a.status) = 'completed' THEN 1 END) AS completed_appointments,
                COUNT(CASE WHEN LOWER(a.status) = 'scheduled' THEN 1 END) AS scheduled_appointments
             FROM ${doctors_table} d
             LEFT JOIN ${spec_table} ds ON d.doctor_id = ds.doctor_id
             LEFT JOIN ${dept_table} dep ON d.department_id = dep.department_id
             LEFT JOIN ${appointments_table} a ON d.doctor_id = a.doctor_id
             ${whereClause}
             GROUP BY d.doctor_id, d.first_name, d.last_name, dep.department_name, ds.specialization
        `;

        const countResult = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM (${groupedQuery}) AS workload_rows`,
            params
        );

        const paginatedParams = [...params, limit, offset];
        const result = await db.query(
            `
             ${groupedQuery}
             ORDER BY total_appointments DESC, doctor_name ASC
             LIMIT $${paginatedParams.length - 1}
             OFFSET $${paginatedParams.length}
            `,
            paginatedParams
        );

        res.status(200).json({
            items: result.rows,
            page,
            limit,
            total: countResult.rows[0].total
        });
    } catch (err) {
        console.error('Error fetching doctor workload:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function medicationTrends(req, res) {
    try {
        const prescriptions_table = getTableName('prescriptions');

        const result = await db.query(
            `SELECT
                medication_name,
                COUNT(*) AS frequency
             FROM ${prescriptions_table}
             GROUP BY medication_name
             ORDER BY frequency DESC`
        );

        res.status(200).json(result.rows);
    } catch (err) {
        console.error('Error fetching medication trends:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getBilling(req, res) {
    try {
        const billing_table = getTableName('billing');
        const appointments_table = getTableName('appointments');
        const patients_table = getTableName('patients');
        const doctors_table = getTableName('doctors');
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const offset = (page - 1) * limit;
        const { q, start_date, end_date } = req.query;
        const params = [];
        const conditions = [];

        if (q) {
            params.push(`%${q}%`);
            conditions.push(`(
                CAST(b.appointment_id AS TEXT) ILIKE $${params.length}
                OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $${params.length}
                OR CONCAT(d.first_name, ' ', d.last_name) ILIKE $${params.length}
                OR COALESCE(b.payment_status, '') ILIKE $${params.length}
                OR COALESCE(b.payment_method, '') ILIKE $${params.length}
            )`);
        }

        if (start_date) {
            params.push(start_date);
            conditions.push(`DATE(b.bill_date) >= $${params.length}`);
        }

        if (end_date) {
            params.push(end_date);
            conditions.push(`DATE(b.bill_date) <= $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countResult = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM ${billing_table} b
             LEFT JOIN ${appointments_table} a ON b.appointment_id = a.appointment_id
             LEFT JOIN ${patients_table} p ON a.patient_id = p.patient_id
             LEFT JOIN ${doctors_table} d ON a.doctor_id = d.doctor_id
             ${whereClause}`,
            params
        );

        params.push(limit);
        params.push(offset);
        const result = await db.query(
            `SELECT
                b.*,
                CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
             FROM ${billing_table} b
             LEFT JOIN ${appointments_table} a ON b.appointment_id = a.appointment_id
             LEFT JOIN ${patients_table} p ON a.patient_id = p.patient_id
             LEFT JOIN ${doctors_table} d ON a.doctor_id = d.doctor_id
             ${whereClause}
             ORDER BY b.bill_id ASC
             LIMIT $${params.length - 1}
             OFFSET $${params.length}`,
            params
        );

        res.status(200).json({
            items: result.rows,
            page,
            limit,
            total: countResult.rows[0].total
        });
    } catch (err) {
        console.error('Error fetching billing:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getBillingByAppointment(req, res) {
    try {
        const billing_table = getTableName('billing');
        const { appointment_id } = req.params;

        const result = await db.query(
            `SELECT *
             FROM ${billing_table}
             WHERE appointment_id = $1
             ORDER BY bill_id DESC
             LIMIT 1`,
            [appointment_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Billing record not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching billing record:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getPrescriptions(req, res) {
    try {
        const prescriptions_table = getTableName('prescriptions');
        const appointments_table = getTableName('appointments');
        const patients_table = getTableName('patients');
        const doctors_table = getTableName('doctors');
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
        const offset = (page - 1) * limit;
        const { q, start_date, end_date } = req.query;
        const params = [];
        const conditions = [];

        if (q) {
            params.push(`%${q}%`);
            conditions.push(`(
                CAST(pr.appointment_id AS TEXT) ILIKE $${params.length}
                OR COALESCE(pr.medication_name, '') ILIKE $${params.length}
                OR COALESCE(pr.dosage, '') ILIKE $${params.length}
                OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $${params.length}
                OR CONCAT(d.first_name, ' ', d.last_name) ILIKE $${params.length}
            )`);
        }

        if (start_date) {
            params.push(start_date);
            conditions.push(`pr.issued_date >= $${params.length}`);
        }

        if (end_date) {
            params.push(end_date);
            conditions.push(`pr.issued_date <= $${params.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countResult = await db.query(
            `SELECT COUNT(*)::int AS total
             FROM ${prescriptions_table} pr
             LEFT JOIN ${appointments_table} a ON pr.appointment_id = a.appointment_id
             LEFT JOIN ${patients_table} p ON a.patient_id = p.patient_id
             LEFT JOIN ${doctors_table} d ON a.doctor_id = d.doctor_id
             ${whereClause}`,
            params
        );

        params.push(limit);
        params.push(offset);
        const result = await db.query(
            `SELECT
                pr.*,
                CONCAT(p.first_name, ' ', p.last_name) AS patient_name,
                CONCAT(d.first_name, ' ', d.last_name) AS doctor_name
             FROM ${prescriptions_table} pr
             LEFT JOIN ${appointments_table} a ON pr.appointment_id = a.appointment_id
             LEFT JOIN ${patients_table} p ON a.patient_id = p.patient_id
             LEFT JOIN ${doctors_table} d ON a.doctor_id = d.doctor_id
             ${whereClause}
             ORDER BY pr.prescription_id ASC
             LIMIT $${params.length - 1}
             OFFSET $${params.length}`,
            params
        );

        res.status(200).json({
            items: result.rows,
            page,
            limit,
            total: countResult.rows[0].total
        });
    } catch (err) {
        console.error('Error fetching prescriptions:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getPrescriptionByAppointment(req, res) {
    try {
        const prescriptions_table = getTableName('prescriptions');
        const { appointment_id } = req.params;

        const result = await db.query(
            `SELECT *
             FROM ${prescriptions_table}
             WHERE appointment_id = $1
             ORDER BY prescription_id DESC
             LIMIT 1`,
            [appointment_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Prescription not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching prescription:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function seedData(req, res) {
    try {
        const { count = 100 } = req.query;

        res.status(202).json({
            message: `Seeding ${count} records initiated`,
            count: parseInt(count, 10),
            status: 'In Progress'
        });
    } catch (err) {
        console.error('Error seeding data:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function resetDatabase(req, res) {
    try {
        const bills_table = getTableName('billing');
        const prescriptions_table = getTableName('prescriptions');
        const appointments_table = getTableName('appointments');
        const doctorSpecTable = getTableName('doctor_specializations');
        const patients_table = getTableName('patients');
        const doctors_table = getTableName('doctors');

        await db.query(`DELETE FROM ${bills_table}`);
        await db.query(`DELETE FROM ${prescriptions_table}`);
        await db.query(`DELETE FROM ${appointments_table}`);
        await db.query(`DELETE FROM ${patients_table}`);
        await db.query(`DELETE FROM ${doctorSpecTable}`);
        await db.query(`DELETE FROM ${doctors_table}`);

        res.status(200).json({ message: 'Database reset successfully' });
    } catch (err) {
        console.error('Error resetting database:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function completeCheckout(req, res) {
    const end = dbQueryTimer.startTimer({ operation: 'complete_checkout' });

    let client;

    try {
        const billing_table = getTableName('billing');
        const {
            appointment_id,
            medication_name,
            dosage,
            consultation_fee = 50.00,
            medicine_charges = 20.00,
            lab_charges = 0.00,
            payment_method = 'Cash'
        } = req.body;

        client = await db.pool.connect();
        await client.query('BEGIN');

        await client.query(
            `CALL ${COMPLETE_CHECKOUT_PROCEDURE}($1, $2, $3, $4, $5, $6, $7)`,
            [
                appointment_id,
                medication_name,
                dosage,
                consultation_fee,
                medicine_charges,
                lab_charges,
                payment_method
            ]
        );

        const billResult = await client.query(
            `SELECT *
             FROM ${billing_table}
             WHERE appointment_id = $1
             ORDER BY bill_id DESC
             LIMIT 1`,
            [appointment_id]
        );

        if (billResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Bill not found after checkout' });
        }

        await client.query('COMMIT');
        res.status(200).json(billResult.rows[0]);
    } catch (err) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackErr) {
                console.error('Rollback error:', rollbackErr.message);
            }
        }
        console.error('Checkout error:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        if (client) {
            client.release();
        }
        end();
    }
}

async function getRecord() {
    try {
        const patients_table = getTableName('patients');
        const appointments_table = getTableName('appointments');
        const doctors_table = getTableName('doctors');

        const result = await db.query(
            `SELECT appointment_id
             FROM ${patients_table}
             JOIN ${appointments_table} ON ${patients_table}.patient_id = ${appointments_table}.patient_id
             JOIN ${doctors_table} ON ${doctors_table}.doctor_id = ${appointments_table}.doctor_id
             LIMIT 10`
        );

        if (result.rows.length > 0) {
            console.log('Record Found:', result.rows);
            return result.rows;
        }

        console.log('No records found in table.');
        return [];
    } catch (err) {
        console.error('Query Error:', err.message);
        return [];
    }
}

module.exports = {
    register,
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
    completeCheckout,
    getRecord
};
