const mongoose = require('mongoose');

// Define schemas (assuming these models exist or will be used)
const patientSchema = new mongoose.Schema({
    first_name: String,
    last_name: String,
    date_of_birth: Date,
    gender: String,
    phone_number: String,
    email: String,
    address: String
}, { timestamps: true });

const doctorSchema = new mongoose.Schema({
    first_name: String,
    last_name: String,
    specialization: String,
    phone_number: String,
    email: String,
    department: String
}, { timestamps: true });

const appointmentSchema = new mongoose.Schema({
    patient_id: mongoose.Schema.Types.ObjectId,
    doctor_id: mongoose.Schema.Types.ObjectId,
    appointment_date: Date,
    appointment_time: String,
    status: { type: String, default: 'Scheduled' }
}, { timestamps: true });

const prescriptionSchema = new mongoose.Schema({
    appointment_id: mongoose.Schema.Types.ObjectId,
    patient_id: mongoose.Schema.Types.ObjectId,
    doctor_id: mongoose.Schema.Types.ObjectId,
    medication_name: String,
    dosage: String,
    issued_date: { type: Date, default: Date.now }
}, { timestamps: true });

const billSchema = new mongoose.Schema({
    appointment_id: mongoose.Schema.Types.ObjectId,
    patient_id: mongoose.Schema.Types.ObjectId,
    amount: Number,
    bill_date: { type: Date, default: Date.now },
    status: { type: String, default: 'Pending' }
}, { timestamps: true });

// Create models
const Patient = mongoose.model('Patient', patientSchema);
const Doctor = mongoose.model('Doctor', doctorSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);
const Prescription = mongoose.model('Prescription', prescriptionSchema);
const Bill = mongoose.model('Bill', billSchema);

// ============= PRIMARY ENDPOINTS =============

/**
 * POST /patients - Add a new patient record
 */
async function addPatient(req, res) {
    try {
        const { first_name, last_name, date_of_birth, gender, phone_number, email, address } = req.body;

        const patient = new Patient({
            first_name,
            last_name,
            date_of_birth,
            gender,
            phone_number,
            email,
            address
        });

        const savedPatient = await patient.save();
        res.status(201).json(savedPatient);
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

        const doctor = new Doctor({
            first_name,
            last_name,
            specialization,
            phone_number,
            email,
            department
        });

        const savedDoctor = await doctor.save();
        res.status(201).json(savedDoctor);
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

        const appointment = new Appointment({
            patient_id,
            doctor_id,
            appointment_date,
            appointment_time,
            status: status || 'Scheduled'
        });

        const savedAppointment = await appointment.save();
        res.status(201).json(savedAppointment);
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

        const patient = await Patient.findById(id);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Fetch appointments for this patient
        const appointments = await Appointment.find({ patient_id: id }).populate('doctor_id');

        res.status(200).json({
            patient,
            appointments
        });
    } catch (err) {
        console.error('Error fetching patient:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * PUT /appointments/:id - Update appointment status
 */
async function updateAppointment(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const appointment = await Appointment.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        res.status(200).json(appointment);
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

        // Delete appointments
        await Appointment.deleteMany({ patient_id: id });

        // Delete prescriptions
        await Prescription.deleteMany({ patient_id: id });

        // Delete bills
        await Bill.deleteMany({ patient_id: id });

        // Delete patient
        const result = await Patient.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.status(200).json({ message: 'Patient deleted successfully', patient: result });
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

        let matchStage = {};
        if (doctor_id) {
            matchStage.doctor_id = new mongoose.Types.ObjectId(doctor_id);
        }

        const pipeline = [
            { $match: matchStage },
            {
                $group: {
                    _id: '$doctor_id',
                    total_appointments: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'doctors',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'doctor'
                }
            },
            { $unwind: '$doctor' },
            {
                $lookup: {
                    from: 'bills',
                    localField: '_id',
                    foreignField: 'doctor_id',
                    as: 'bills'
                }
            },
            {
                $project: {
                    doctor_id: '$_id',
                    doctor_name: { $concat: ['$doctor.first_name', ' ', '$doctor.last_name'] },
                    department: '$doctor.department',
                    total_appointments: 1,
                    total_revenue: { $sum: '$bills.amount' },
                    _id: 0
                }
            },
            { $sort: { total_revenue: -1 } }
        ];

        if (department) {
            pipeline.push({
                $match: { department }
            });
        }

        const results = await Doctor.aggregate(pipeline);
        res.status(200).json(results);
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
        const pipeline = [
            {
                $lookup: {
                    from: 'appointments',
                    localField: '_id',
                    foreignField: 'doctor_id',
                    as: 'appointments'
                }
            },
            {
                $project: {
                    doctor_id: '$_id',
                    doctor_name: { $concat: ['$first_name', ' ', '$last_name'] },
                    specialization: 1,
                    unique_patients: {
                        $size: {
                            $setToArray: '$appointments.patient_id'
                        }
                    },
                    total_appointments: { $size: '$appointments' },
                    completed_appointments: {
                        $size: {
                            $filter: {
                                input: '$appointments',
                                as: 'appt',
                                cond: { $eq: ['$$appt.status', 'Completed'] }
                            }
                        }
                    },
                    scheduled_appointments: {
                        $size: {
                            $filter: {
                                input: '$appointments',
                                as: 'appt',
                                cond: { $eq: ['$$appt.status', 'Scheduled'] }
                            }
                        }
                    },
                    _id: 0
                }
            },
            { $sort: { total_appointments: -1 } }
        ];

        const results = await Doctor.aggregate(pipeline);
        res.status(200).json(results);
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
        const pipeline = [
            {
                $group: {
                    _id: '$medication_name',
                    frequency: { $sum: 1 },
                    unique_patients: { $addToSet: '$patient_id' },
                    unique_doctors: { $addToSet: '$doctor_id' }
                }
            },
            {
                $project: {
                    medication_name: '$_id',
                    frequency: 1,
                    unique_patients: { $size: '$unique_patients' },
                    unique_doctors: { $size: '$unique_doctors' },
                    _id: 0
                }
            },
            { $sort: { frequency: -1 } }
        ];

        const results = await Prescription.aggregate(pipeline);
        res.status(200).json(results);
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
        // Delete all documents from all collections
        await Bill.deleteMany({});
        await Prescription.deleteMany({});
        await Appointment.deleteMany({});
        await Patient.deleteMany({});
        await Doctor.deleteMany({});

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
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { appointment_id, medication_name, dosage, amount } = req.body;

        // 1. Mark appointment as completed
        const appointment = await Appointment.findByIdAndUpdate(
            appointment_id,
            { status: 'Completed' },
            { new: true, session }
        );

        if (!appointment) {
            await session.abortTransaction();
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // 2. Issue prescription
        const prescription = new Prescription({
            appointment_id,
            patient_id: appointment.patient_id,
            doctor_id: appointment.doctor_id,
            medication_name,
            dosage,
            issued_date: new Date()
        });
        const savedPrescription = await prescription.save({ session });

        // 3. Create bill
        const bill = new Bill({
            appointment_id,
            patient_id: appointment.patient_id,
            amount,
            bill_date: new Date(),
            status: 'Pending'
        });
        const savedBill = await bill.save({ session });

        await session.commitTransaction();

        res.status(200).json({
            appointment,
            prescription: savedPrescription,
            bill: savedBill
        });

    } catch (err) {
        await session.abortTransaction();
        console.error('Error in complete checkout:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        session.endSession();
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
    completeCheckout
};
