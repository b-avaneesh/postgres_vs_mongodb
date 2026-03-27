const db = require('./get-client.postgres');

async function getRecord() {
    try {
        // Use the pool's query method directly
        //const res = await db.query('SELECT * FROM patients_5k LIMIT 10');
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

module.exports = { getRecord };