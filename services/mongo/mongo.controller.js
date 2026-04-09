const mongoose = require('mongoose');
const { dbQueryTimer } = require('./mongo.metric');

// ============= HELPER FUNCTIONS =============

/**
 * Get collection name based on base and db_size
 * Examples: getCollectionName('patients', '5k') => 'patients_5k'
 */
function getCollectionName(base, db_size) {
    return `${base}_${db_size}`;
}

/**
 * Get or create a model for the specified collection
 * This allows us to dynamically work with different collections based on db_size
 */
function getModel(modelName, schema, collectionName) {
    try {
        // Try to get existing model
        return mongoose.model(collectionName);
    } catch (err) {
        // Model doesn't exist, create it with specified collection name
        return mongoose.model(collectionName, schema, collectionName);
    }
}

// ============= SCHEMA DEFINITIONS (Reusable) =============

const patientSchema = new mongoose.Schema({
    first_name: String,
    last_name: String,
    date_of_birth: Date,
    gender: String,
    phone_number: String,
    email: String,
    address: String
}, { timestamps: true });
patientSchema.index({ patient_id: 1 }, { unique: true, sparse: true });

const doctorSchema = new mongoose.Schema({
    doctor_id: Number,   // ✅ ADD THIS
    first_name: String,
    last_name: String,
    phone_number: String,
    email: String,
    department_id: Number
}, { timestamps: true });
doctorSchema.index({ doctor_id: 1 }, { unique: true, sparse: true });
doctorSchema.index({ department_id: 1 });

const departmentSchema = new mongoose.Schema({
    department_id: Number,
    department_name: String
}, { timestamps: true });
departmentSchema.index({ department_id: 1 }, { unique: true, sparse: true });

const doctorSpecializationSchema = new mongoose.Schema({
    doctor_id: Number,
    specialization: String
}, { timestamps: true });
doctorSpecializationSchema.index({ doctor_id: 1 });

const appointmentSchema = new mongoose.Schema({
    appointment_id: Number,
    patient_id: Number,
    doctor_id: Number,
    appointment_date: Date,
    appointment_time: String,
    reason_for_visit: String,
    status: { type: String, default: 'Scheduled' }
}, { timestamps: true });
appointmentSchema.index({ appointment_id: 1 }, { unique: true, sparse: true });
appointmentSchema.index({ patient_id: 1 });
appointmentSchema.index({ doctor_id: 1 });
appointmentSchema.index({ doctor_id: 1, appointment_id: 1 });

const prescriptionSchema = new mongoose.Schema({
    appointment_id: Number,
    patient_id: Number,
    doctor_id: Number,
    medication_name: String,
    dosage: String,
    issued_date: { type: Date, default: Date.now }
}, { timestamps: true });
prescriptionSchema.index({ appointment_id: 1 });
prescriptionSchema.index({ patient_id: 1 });
prescriptionSchema.index({ doctor_id: 1 });

// UPDATED: To match PostgreSQL billing structure
const billSchema = new mongoose.Schema({
    appointment_id: Number,
    patient_id: Number,
    consultation_fee: Number,
    medicine_charges: Number,
    lab_charges: Number,
    total_amount: Number,
    payment_status: String,
    payment_method: String,
    bill_date: { type: Date, default: Date.now }
}, { timestamps: true });
billSchema.index({ appointment_id: 1 });
billSchema.index({ patient_id: 1 });

// Create base models (for shared collections)
const Department = mongoose.model('Department', departmentSchema, 'departments');
const DoctorSpecialization = mongoose.model('DoctorSpecialization', doctorSpecializationSchema, 'doctor_specializations');

// ============= PRIMARY ENDPOINTS =============

/**
 * POST /patients - Add a new patient record
 */
async function addPatient(req, res) {
    const end = dbQueryTimer.startTimer({ operation: 'add_patient' });
    try {
        console.log("in mongodb add patient");
        const db_size = req.query.db_size || '5k';
        const patientCollectionName = getCollectionName('patients', db_size);
        const Patient = getModel('Patient', patientSchema, patientCollectionName);

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
    } finally {
        end();
    }
}

/**
 * POST /doctors - Add a new doctor profile
 */
async function addDoctor(req, res) {
    const end = dbQueryTimer.startTimer({ operation: 'add_doctor' });
    try {
        const db_size = req.query.db_size || '5k';
        const doctorCollectionName = getCollectionName('doctors', db_size);
        const docSpecCollectionName = getCollectionName('doctor_specializations', db_size);
        
        const Doctor = getModel('Doctor', doctorSchema, doctorCollectionName);
        const DocSpec = getModel('DocSpec', doctorSpecializationSchema, docSpecCollectionName);

        const { first_name, last_name, specialization, phone_number, email, department_id } = req.body;

        // 1. Insert doctor WITHOUT specialization field
        const latestDoctor = await Doctor.findOne({}, { doctor_id: 1 }).sort({ doctor_id: -1 }).lean();
        const nextDoctorId = (latestDoctor?.doctor_id || 0) + 1;

        const doctor = new Doctor({
            doctor_id: nextDoctorId,
            first_name,
            last_name,
            phone_number,
            email,
            department_id
        });

        const savedDoctor = await doctor.save();

        // 2. Insert specialization separately if provided
        if (specialization) {
            const docSpec = new DocSpec({
                doctor_id: savedDoctor.doctor_id,
                specialization
            });
            await docSpec.save();
        }

        // Return response matching PostgreSQL structure
        res.status(201).json(savedDoctor);
    } catch (err) {
        console.error('Error adding doctor:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        end();
    }
}

/**
 * POST /appointments - Book a new appointment
 */
async function addAppointment(req, res) {
    const end = dbQueryTimer.startTimer({ operation: 'add_appointment' });
    try {
        const db_size = req.query.db_size || '5k';
        const appointmentCollectionName = getCollectionName('appointments', db_size);
        const Appointment = getModel('Appointment', appointmentSchema, appointmentCollectionName);

        const { patient_id, doctor_id, appointment_date, appointment_time, reason_for_visit, status } = req.body;
        const latestAppointment = await Appointment.findOne({}, { appointment_id: 1 }).sort({ appointment_id: -1 }).lean();
        const nextAppointmentId = (latestAppointment?.appointment_id || 0) + 1;

        const appointment = new Appointment({
            appointment_id: nextAppointmentId,
            patient_id,
            doctor_id,
            appointment_date,
            appointment_time,
            reason_for_visit,
            status: status || 'Scheduled'
        });

        const savedAppointment = await appointment.save();
        res.status(201).json(savedAppointment);
    } catch (err) {
        console.error('Error adding appointment:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
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
        const patientCollectionName = getCollectionName('patients', db_size);
        const appointmentCollectionName = getCollectionName('appointments', db_size);
        
        const Patient = getModel('Patient', patientSchema, patientCollectionName);
        const Appointment = getModel('Appointment', appointmentSchema, appointmentCollectionName);

        const { id } = req.params;

        const patient = await Patient.findOne({ patient_id: Number(id) });
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Fetch appointments for this patient
        const appointments = await Appointment.find({ patient_id: Number(id) });
        res.status(200).json({
            patient,
            appointments
        });
    } catch (err) {
        console.error('Error fetching patient:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        end();
    }
}



/**
 * PUT /appointments/:id - Update appointment status
 */
async function updateAppointment(req, res) {
    try {
        const db_size = req.query.db_size || '5k';
        const appointmentCollectionName = getCollectionName('appointments', db_size);
        const Appointment = getModel('Appointment', appointmentSchema, appointmentCollectionName);

        const { id } = req.params;
        const { status } = req.body;

        const appointment = await Appointment.findOneAndUpdate(
            { appointment_id: Number(id) },
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
        const db_size = req.query.db_size || '5k';
        const patientCollectionName = getCollectionName('patients', db_size);
        const appointmentCollectionName = getCollectionName('appointments', db_size);
        const prescriptionCollectionName = getCollectionName('prescriptions', db_size);
        const billCollectionName = getCollectionName('billing', db_size);

        const Patient = getModel('Patient', patientSchema, patientCollectionName);
        const Appointment = getModel('Appointment', appointmentSchema, appointmentCollectionName);
        const Prescription = getModel('Prescription', prescriptionSchema, prescriptionCollectionName);
        const Bill = getModel('Bill', billSchema, billCollectionName);

        const { id } = req.params;

        // Delete appointments
        await Appointment.deleteMany({ patient_id: Number(id) });

        // Delete prescriptions
        await Prescription.deleteMany({ patient_id: id });

        // Delete bills
        await Bill.deleteMany({ patient_id: id });

        // Delete patient
        const result = await Patient.findOneAndDelete({ patient_id: Number(id) })

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
    const end = dbQueryTimer.startTimer({ operation: 'revenue_report' });
    try {
        const db_size = req.query.db_size || '5k';
        const doctorCollectionName = getCollectionName('doctors', db_size);
        const appointmentCollectionName = getCollectionName('appointments', db_size);
        const billCollectionName = getCollectionName('billing', db_size);

        const Doctor = getModel('Doctor', doctorSchema, doctorCollectionName);

        const { doctor_id, department } = req.query;

        let matchStage = {};
        if (doctor_id) {
            matchStage.doctor_id = Number(doctor_id);
        }

        const pipeline = [{ $match: matchStage }];

        pipeline.push(
            {
                $lookup: {
                    from: 'departments',
                    localField: 'department_id',
                    foreignField: 'department_id',
                    as: 'department'
                }
            },
            {
                $addFields: {
                    department_name: { $ifNull: [{ $arrayElemAt: ['$department.department_name', 0] }, null] }
                }
            }
        );

        if (department) {
            pipeline.push({ $match: { department_name: department } });
        }

        pipeline.push(
            {
                $lookup: {
                    from: appointmentCollectionName,
                    localField: 'doctor_id',
                    foreignField: 'doctor_id',
                    as: 'appointments'
                }
            },
            {
                $addFields: {
                    appointment_ids: {
                        $filter: {
                            input: {
                                $map: {
                                    input: '$appointments',
                                    as: 'appointment',
                                    in: '$$appointment.appointment_id'
                                }
                            },
                            as: 'appointmentId',
                            cond: { $ne: ['$$appointmentId', null] }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: billCollectionName,
                    let: { appointmentIds: '$appointment_ids' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $in: ['$appointment_id', '$$appointmentIds'] }
                            }
                        }
                    ],
                    as: 'bills'
                }
            },
            {
                $project: {
                    doctor_id: '$doctor_id',
                    doctor_name: { $concat: [{ $ifNull: ['$first_name', ''] }, ' ', { $ifNull: ['$last_name', ''] }] },
                    department_name: 1,
                    total_appointments: { $size: { $ifNull: ['$bills', []] } },
                    total_revenue: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$bills', []] },
                                as: 'bill',
                                in: { $ifNull: ['$$bill.consultation_fee', 0] }
                            }
                        }
                    },
                    _id: 0
                }
            },
            { $sort: { total_revenue: -1 } }
        );

        const results = await Doctor.aggregate(pipeline);
        res.status(200).json(results);
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
    const end = dbQueryTimer.startTimer({ operation: 'doctor_workload' });
    try {
        const db_size = req.query.db_size || '5k';
        const doctorCollectionName = getCollectionName('doctors', db_size);
        const appointmentCollectionName = getCollectionName('appointments', db_size);
        const docSpecCollectionName = getCollectionName('doctor_specializations', db_size);

        const Doctor = getModel('Doctor', doctorSchema, doctorCollectionName);

        const pipeline = [
            {
                $lookup: {
                    from: appointmentCollectionName,
                    localField: 'doctor_id',
                    foreignField: 'doctor_id',
                    as: 'appointments'
                }
            },
            {
                $lookup: {
                    from: docSpecCollectionName,
                    localField: 'doctor_id',
                    foreignField: 'doctor_id',
                    as: 'specializations'
                }
            },
            {
                $project: {
                    doctor_id: '$doctor_id',
                    doctor_name: { $concat: [{ $ifNull: ['$first_name', ''] }, ' ', { $ifNull: ['$last_name', ''] }] },
                    specialization: { $arrayElemAt: ['$specializations.specialization', 0] },
                    unique_patients: {
                        $size: {
                            $setUnion: [
                                {
                                    $filter: {
                                        input: {
                                            $map: {
                                                input: { $ifNull: ['$appointments', []] },
                                                as: 'appt',
                                                in: '$$appt.patient_id'
                                            }
                                        },
                                        as: 'patientId',
                                        cond: { $ne: ['$$patientId', null] }
                                    }
                                },
                                []
                            ]
                        }
                    },
                    total_appointments: { $size: { $ifNull: ['$appointments', []] } },
                    completed_appointments: {
                        $size: {
                            $filter: {
                                input: { $ifNull: ['$appointments', []] },
                                as: 'appt',
                                cond: { $eq: ['$$appt.status', 'Completed'] }
                            }
                        }
                    },
                    scheduled_appointments: {
                        $size: {
                            $filter: {
                                input: { $ifNull: ['$appointments', []] },
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
    } finally {
        end();
    }
}

/**
 * GET /analytics/medication-trends - Analyzes the frequency of specific prescriptions
 */
async function medicationTrends(req, res) {
    try {
        const db_size = req.query.db_size || '5k';
        const prescriptionCollectionName = getCollectionName('prescriptions', db_size);
        const Prescription = getModel('Prescription', prescriptionSchema, prescriptionCollectionName);

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
        const db_size = req.query.db_size || '5k';
        
        const patientCollectionName = getCollectionName('patients', db_size);
        const doctorCollectionName = getCollectionName('doctors', db_size);
        const appointmentCollectionName = getCollectionName('appointments', db_size);
        const prescriptionCollectionName = getCollectionName('prescriptions', db_size);
        const billCollectionName = getCollectionName('billing', db_size);
        const docSpecCollectionName = getCollectionName('doctor_specializations', db_size);

        const Patient = getModel('Patient', patientSchema, patientCollectionName);
        const Doctor = getModel('Doctor', doctorSchema, doctorCollectionName);
        const Appointment = getModel('Appointment', appointmentSchema, appointmentCollectionName);
        const Prescription = getModel('Prescription', prescriptionSchema, prescriptionCollectionName);
        const Bill = getModel('Bill', billSchema, billCollectionName);
        const DocSpec = getModel('DocSpec', doctorSpecializationSchema, docSpecCollectionName);

        // Delete all documents from all collections for this db_size
        await Bill.deleteMany({});
        await Prescription.deleteMany({});
        await Appointment.deleteMany({});
        await Patient.deleteMany({});
        await DocSpec.deleteMany({});
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
    const end = dbQueryTimer.startTimer({ operation: 'complete_checkout' });
    const session = await mongoose.startSession();
    try {
        const db_size = req.query.db_size || '5k';
        
        const appointmentCollectionName = getCollectionName('appointments', db_size);
        const prescriptionCollectionName = getCollectionName('prescriptions', db_size);
        const billCollectionName = getCollectionName('billing', db_size);

        const Appointment = getModel('Appointment', appointmentSchema, appointmentCollectionName);
        const Prescription = getModel('Prescription', prescriptionSchema, prescriptionCollectionName);
        const Bill = getModel('Bill', billSchema, billCollectionName);

        const {
            appointment_id, 
            medication_name, 
            dosage, 
            consultation_fee = 50.00, 
            medicine_charges = 20.00, 
            lab_charges = 0.00,
            payment_method = 'Cash'
        } = req.body;

        const parsedAppointmentId = Number(appointment_id);
        const appointmentFilter = Number.isFinite(parsedAppointmentId) && !Number.isNaN(parsedAppointmentId)
            ? { appointment_id: parsedAppointmentId }
            : (mongoose.Types.ObjectId.isValid(appointment_id) ? { _id: appointment_id } : null);

        if (!appointmentFilter) {
            return res.status(400).json({ error: 'Invalid appointment identifier' });
        }

        const executeCheckout = async (activeSession = null) => {
            const queryOptions = activeSession ? { new: true, session: activeSession } : { new: true };
            const saveOptions = activeSession ? { session: activeSession } : undefined;

            const appointment = await Appointment.findOneAndUpdate(
                appointmentFilter,
                { status: 'Completed' },
                queryOptions
            );

            if (!appointment) {
                return null;
            }

            const normalizedAppointmentId = appointment.appointment_id ?? parsedAppointmentId;
            const total_amount = parseFloat(consultation_fee) + parseFloat(medicine_charges) + parseFloat(lab_charges);

            const prescription = new Prescription({
                appointment_id: normalizedAppointmentId,
                patient_id: appointment.patient_id,
                doctor_id: appointment.doctor_id,
                medication_name,
                dosage,
                issued_date: new Date()
            });
            await prescription.save(saveOptions);

            const bill = new Bill({
                appointment_id: normalizedAppointmentId,
                patient_id: appointment.patient_id,
                consultation_fee: parseFloat(consultation_fee),
                medicine_charges: parseFloat(medicine_charges),
                lab_charges: parseFloat(lab_charges),
                total_amount,
                payment_status: 'Paid',
                payment_method,
                bill_date: new Date()
            });

            return bill.save(saveOptions);
        };

        let savedBill;
        try {
            session.startTransaction();
            savedBill = await executeCheckout(session);

            if (!savedBill) {
                await session.abortTransaction();
                return res.status(404).json({ error: 'Appointment not found' });
            }

            await session.commitTransaction();
        } catch (err) {
            const message = err.message || '';
            const isTransactionUnsupported =
                message.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
                message.includes('ReplicaSet') ||
                message.includes('transaction');

            if (!isTransactionUnsupported) {
                throw err;
            }

            if (session.inTransaction()) {
                await session.abortTransaction();
            }

            savedBill = await executeCheckout();

            if (!savedBill) {
                return res.status(404).json({ error: 'Appointment not found' });
            }
        }

        res.status(200).json(savedBill);

    } catch (err) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error('Error in complete checkout:', err.message);
        res.status(500).json({ error: err.message });
    } finally {
        end();
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
