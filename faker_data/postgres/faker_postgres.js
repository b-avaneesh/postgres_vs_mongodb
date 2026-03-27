/**
* @name - faker_postgres.js
* @description - run this file to generate synthetic records - generates data proportionally
* - @doctor - n/20
* - @appointments - n*3
* - @prescriptions - n*2
* - @billing - n*2
* 
* @param - pass through cmd.
* @example - node faker_postgres 5000
*
*/


const { faker } = require('@faker-js/faker')
const fs = require('fs')

faker.seed(42) // data persistence.

const SIZE = parseInt(process.argv[2]) || 1000


const DOCTORS = Math.floor(SIZE / 20)
const APPOINTMENTS = SIZE * 3
const PRESCRIPTIONS = SIZE * 2
const BILLING = SIZE * 2

fs.mkdirSync(`datasets/${SIZE}`, { recursive: true })

/* ---------------- PATIENTS ---------------- */

let stream = fs.createWriteStream(`datasets/${SIZE}/patients${SIZE}.csv`)

stream.write(
"patient_id,first_name,last_name,date_of_birth,gender,phone,email,address,blood_group,emergency_contact,created_at\n"
)

for (let i = 1; i <= SIZE; i++) {

 const row = [
  i,
  faker.person.firstName(),
  faker.person.lastName(),
  faker.date.birthdate({min:18,max:80,mode:'age'}).toISOString().split('T')[0],
  faker.helpers.arrayElement(['Male','Female']),
  faker.phone.number({ style: 'international' }),
  faker.internet.email(),
  faker.location.streetAddress(),
  faker.helpers.arrayElement(['A+','A-','B+','B-','O+','O-','AB+','AB-']),
  faker.phone.number({ style: 'international' }),
  new Date().toISOString()
 ]

 stream.write(row.join(",") + "\n")
}

stream.end()


/* ---------------- DOCTORS ---------------- */

stream = fs.createWriteStream(`datasets/${SIZE}/doctors${SIZE}.csv`)

stream.write(
"doctor_id,first_name,last_name,specialization,phone,email,years_of_experience,license_number,department,created_at\n"
)

for (let i = 1; i <= DOCTORS; i++) {

 const row = [
  i,
  faker.person.firstName(),
  faker.person.lastName(),
  faker.helpers.arrayElement(['Cardiology','Neurology','Orthopedics','Dermatology','Pediatrics']),
  faker.phone.number({ style: 'international' }),
  faker.internet.email(),
  faker.number.int({min:1,max:40}),
  faker.string.alphanumeric(10),
  faker.helpers.arrayElement(['General','Surgery','Emergency','Outpatient']),
  new Date().toISOString()
 ]

 stream.write(row.join(",") + "\n")
}

stream.end()


/* ---------------- APPOINTMENTS ---------------- */

stream = fs.createWriteStream(`datasets/${SIZE}/appointments${SIZE}.csv`)

stream.write(
"appointment_id,patient_id,doctor_id,appointment_date,appointment_time,status,reason_for_visit,created_at\n"
)

for (let i = 1; i <= APPOINTMENTS; i++) {

 const row = [
  i,
  faker.number.int({min:1,max:SIZE}),
  faker.number.int({min:1,max:DOCTORS}),
  faker.date.soon().toISOString().split("T")[0],
  faker.date.anytime().toISOString().split("T")[1].split(".")[0],
  faker.helpers.arrayElement(['Scheduled','Completed','Cancelled']),
  faker.lorem.sentence(),
  new Date().toISOString()
 ]

 stream.write(row.join(",") + "\n")
}

stream.end()


/* ---------------- PRESCRIPTIONS ---------------- */

stream = fs.createWriteStream(`datasets/${SIZE}/prescriptions${SIZE}.csv`)

stream.write(
"prescription_id,appointment_id,medication_name,dosage,frequency,duration_days,notes,issued_date\n"
)

for (let i = 1; i <= PRESCRIPTIONS; i++) {

 const row = [
  i,
  faker.number.int({min:1,max:APPOINTMENTS}),
  faker.helpers.arrayElement(['Paracetamol','Ibuprofen','Amoxicillin','Metformin']),
  faker.helpers.arrayElement(['250mg','500mg','1g']),
  faker.helpers.arrayElement(['Once daily','Twice daily','Three times daily']),
  faker.number.int({min:3,max:14}),
  faker.lorem.sentence(),
  faker.date.recent().toISOString().split("T")[0]
 ]

 stream.write(row.join(",") + "\n")
}

stream.end()


/* ---------------- BILLING ---------------- */

stream = fs.createWriteStream(`datasets/${SIZE}/billing${SIZE}.csv`)

stream.write(
"bill_id,appointment_id,consultation_fee,medicine_charges,lab_charges,total_amount,payment_status,payment_method,bill_date\n"
)

for (let i = 1; i <= BILLING; i++) {

 const consultation = faker.number.int({min:200,max:1000})
 const medicine = faker.number.int({min:100,max:500})
 const lab = faker.number.int({min:0,max:800})

 const row = [
  i,
  faker.number.int({min:1,max:APPOINTMENTS}),
  consultation,
  medicine,
  lab,
  consultation + medicine + lab,
  faker.helpers.arrayElement(['Paid','Pending']),
  faker.helpers.arrayElement(['Cash','Card','UPI']),
  faker.date.recent().toISOString()
 ]

 stream.write(row.join(",") + "\n")
}

stream.end()