    /**
     * Description: Standard response structure for patient,doctor,billing,appointments,prescriptions.
     * P.S: It'll require mapping in each of the services, mongo and postgres respectively with each mapping function parsing the mapped data.
     */


const { z } = require("zod");


/**
 * Data contract for Patient
 * follows ER model definitions
 */
const PatientSchema = z.object({
  patient_id: z.number().int(),

  first_name: z.string().max(50),
  last_name: z.string().max(50),

  date_of_birth: z.coerce.date(),

  gender: z.enum(["Male", "Female", "Other"]),

  phone: z.string().max(15),
  email: z.string().email().max(100).optional(),

  address: z.string().optional(),
  blood_group: z.string().max(5).optional(),

  emergency_contact: z.string().max(15).optional(),

  created_at: z.coerce.date()
});

/**
 * Data contract for Doctor 
 */
const DoctorSchema = z.object({
  doctor_id: z.number().int(),

  first_name: z.string().max(50),
  last_name: z.string().max(50),

  specialization: z.string().max(100),

  phone: z.string().max(15).optional(),
  email: z.string().email().max(100).optional(),

  years_of_experience: z.number().int().min(0),

  license_number: z.string().max(50),

  department: z.string().max(100).optional(),

  created_at: z.coerce.date()
});

/**
 * Data contract for appointment
 */
const AppointmentSchema = z.object({
  appointment_id: z.number().int(),

  patient_id: z.number().int(),
  doctor_id: z.number().int(),

  appointment_date: z.coerce.date(),
  appointment_time: z.string(), // keep as string (HH:mm:ss)

  status: z.enum([
    "Scheduled",
    "Completed",
    "Cancelled",
    "No-show"
  ]),

  reason_for_visit: z.string().optional(),

  created_at: z.coerce.date()
});


/**
 * Data contract for prescription
 */
const PrescriptionSchema = z.object({
  prescription_id: z.number().int(),

  appointment_id: z.number().int(),

  medication_name: z.string().max(100),

  dosage: z.string().max(50).optional(),
  frequency: z.string().max(50).optional(),

  duration_days: z.number().int().positive().optional(),

  notes: z.string().optional(),

  issued_date: z.coerce.date()
});


/**
 * Data contract for billing
 */
const BillingSchema = z.object({
  bill_id: z.number().int(),

  appointment_id: z.number().int(),

  consultation_fee: z.number(),
  medicine_charges: z.number().optional(),
  lab_charges: z.number().optional(),

  total_amount: z.number(),

  payment_status: z.enum(["Paid", "Pending", "Cancelled"]),

  payment_method: z.string().max(20).optional(),

  bill_date: z.coerce.date()
});


// =====================
// EXPORT
// =====================
module.exports = {
  PatientSchema,
  DoctorSchema,
  AppointmentSchema,
  PrescriptionSchema,
  BillingSchema
};