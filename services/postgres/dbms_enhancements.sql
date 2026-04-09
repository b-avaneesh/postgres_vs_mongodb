/* =========================================================
   PostgreSQL DBMS Enhancements for 5k Dataset Only
   =========================================================

   This script enhances only:
   - patients_5k
   - doctors_5k
   - appointments_5k
   - prescriptions_5k
   - billing_5k

   Order:
   1. Tables
   2. Constraints
   3. Functions
   4. Procedures
   5. Triggers
*/

/* =========================================================
   1. TABLES
   =========================================================
   Existing tables used by this script:
   - patients_5k
   - doctors_5k
   - appointments_5k
   - prescriptions_5k
   - billing_5k
*/
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin','superadmin')) NOT NULL
);
-- If using pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO users (username, password, role) VALUES
('admin1', crypt('admin123', gen_salt('bf')), 'admin'),
('admin2', crypt('admin123', gen_salt('bf')), 'admin'),
('admin3', crypt('admin123', gen_salt('bf')), 'admin'),
('superadmin1', crypt('super123', gen_salt('bf')), 'superadmin'),
('superadmin2', crypt('super123', gen_salt('bf')), 'superadmin');

/* =========================================================
   2. CONSTRAINTS
   ========================================================= */

ALTER TABLE appointments_5k
DROP CONSTRAINT IF EXISTS appointments_5k_patient_id_fkey;

ALTER TABLE appointments_5k
DROP CONSTRAINT IF EXISTS appointments_5k_doctor_id_fkey;

ALTER TABLE appointments_5k
DROP CONSTRAINT IF EXISTS appointments_5k_patient_fk;

ALTER TABLE appointments_5k
DROP CONSTRAINT IF EXISTS appointments_5k_doctor_fk;

ALTER TABLE appointments_5k
DROP CONSTRAINT IF EXISTS appointments_5k_doctor_time_unique;

ALTER TABLE appointments_5k
DROP CONSTRAINT IF EXISTS appointments_5k_status_check;

ALTER TABLE prescriptions_5k
DROP CONSTRAINT IF EXISTS prescriptions_5k_appointment_id_fkey;

ALTER TABLE prescriptions_5k
DROP CONSTRAINT IF EXISTS prescriptions_5k_appointment_fk;

ALTER TABLE doctor_specializations_5k
DROP CONSTRAINT IF EXISTS doctor_specializations_5k_doctor_id_fkey;

ALTER TABLE doctor_specializations_5k
DROP CONSTRAINT IF EXISTS doctor_specializations_5k_doctor_fk;

ALTER TABLE billing_5k
DROP CONSTRAINT IF EXISTS billing_5k_appointment_id_fkey;

ALTER TABLE billing_5k
DROP CONSTRAINT IF EXISTS billing_5k_appointment_fk;

ALTER TABLE appointments_5k
ADD CONSTRAINT appointments_5k_patient_fk
FOREIGN KEY (patient_id)
REFERENCES patients_5k(patient_id)
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE appointments_5k
ADD CONSTRAINT appointments_5k_doctor_fk
FOREIGN KEY (doctor_id)
REFERENCES doctors_5k(doctor_id)
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE appointments_5k
ADD CONSTRAINT appointments_5k_doctor_time_unique
UNIQUE (doctor_id, appointment_date, appointment_time);

ALTER TABLE appointments_5k
ADD CONSTRAINT appointments_5k_status_check
CHECK (LOWER(status) IN ('scheduled', 'completed', 'cancelled'));

ALTER TABLE doctor_specializations_5k
ADD CONSTRAINT doctor_specializations_5k_doctor_fk
FOREIGN KEY (doctor_id)
REFERENCES doctors_5k(doctor_id)
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE prescriptions_5k
ADD CONSTRAINT prescriptions_5k_appointment_fk
FOREIGN KEY (appointment_id)
REFERENCES appointments_5k(appointment_id)
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE billing_5k
ADD CONSTRAINT billing_5k_appointment_fk
FOREIGN KEY (appointment_id)
REFERENCES appointments_5k(appointment_id)
ON DELETE CASCADE
ON UPDATE CASCADE;

/* =========================================================
   3. FUNCTIONS
   ========================================================= */

CREATE OR REPLACE FUNCTION validate_appointment_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    requested_timestamp TIMESTAMP;
BEGIN
    IF NEW.status IS NULL OR BTRIM(NEW.status) = '' THEN
        NEW.status := 'scheduled';
    ELSE
        NEW.status := LOWER(NEW.status);
    END IF;

    requested_timestamp := NEW.appointment_date + NEW.appointment_time;

    IF requested_timestamp <= NOW() THEN
        RAISE EXCEPTION 'Appointment must be booked for a future date and time.';
    END IF;

    IF NEW.appointment_time < TIME '09:00:00'
       OR NEW.appointment_time >= TIME '17:00:00' THEN
        RAISE EXCEPTION 'Appointments are allowed only between 09:00 and 17:00.';
    END IF;

  IF EXISTS (
      SELECT 1
      FROM appointments_5k
      WHERE doctor_id = NEW.doctor_id
        AND appointment_date = NEW.appointment_date
        AND ABS(EXTRACT(EPOCH FROM (
            ((appointment_date + appointment_time) - (NEW.appointment_date + NEW.appointment_time))
        ))) < 1800
        AND appointment_id <> COALESCE(NEW.appointment_id, -1)
  ) THEN
      RAISE EXCEPTION 'Doctor % already has an appointment within 30 minutes of % %.',
          NEW.doctor_id,
          NEW.appointment_date,
          NEW.appointment_time;
  END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_patient_date_of_birth_5k()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.date_of_birth IS NOT NULL AND NEW.date_of_birth > CURRENT_DATE THEN
        RAISE EXCEPTION 'Date of birth cannot be in the future.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_duplicate_patient_5k()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM patients_5k p
        WHERE LOWER(BTRIM(p.first_name)) = LOWER(BTRIM(NEW.first_name))
          AND LOWER(BTRIM(p.last_name)) = LOWER(BTRIM(NEW.last_name))
          AND COALESCE(BTRIM(p.phone), '') = COALESCE(BTRIM(NEW.phone), '')
          AND p.date_of_birth IS NOT DISTINCT FROM NEW.date_of_birth
          AND p.patient_id <> COALESCE(NEW.patient_id, -1)
    ) THEN
        RAISE EXCEPTION 'Patient already exists with the same name, phone, and date of birth.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION get_doctor_revenue_5k(p_doctor_id INT)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total NUMERIC(12,2);
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM doctors_5k WHERE doctor_id = p_doctor_id
    ) THEN
        RAISE EXCEPTION 'Doctor % does not exist.', p_doctor_id;
    END IF;

    SELECT COALESCE(SUM(b.consultation_fee), 0)
    INTO v_total
    FROM appointments_5k a
    LEFT JOIN billing_5k b
      ON a.appointment_id = b.appointment_id
    WHERE a.doctor_id = p_doctor_id
      AND LOWER(a.status) = 'completed';

    RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION get_doctor_appointment_count_5k(p_doctor_id INT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM doctors_5k WHERE doctor_id = p_doctor_id
    ) THEN
        RAISE EXCEPTION 'Doctor % does not exist.', p_doctor_id;
    END IF;

    SELECT COUNT(*)
    INTO v_count
    FROM appointments_5k
    WHERE doctor_id = p_doctor_id;

    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_checkout_total_5k(p_subtotal NUMERIC(10,2))
RETURNS NUMERIC(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
    v_subtotal NUMERIC(10,2) := COALESCE(p_subtotal, 0);
    v_tax_rate NUMERIC(5,4) := 0.05;
    v_discount_rate NUMERIC(5,4) := 0.00;
    v_tax_amount NUMERIC(10,2);
    v_discount_amount NUMERIC(10,2);
BEGIN
    /*
      Keep discount at 0 unless the schema later introduces a discount source.
      The helper remains useful because the billing rule is centralized here.
    */
    v_tax_amount := ROUND(v_subtotal * v_tax_rate, 2);
    v_discount_amount := ROUND(v_subtotal * v_discount_rate, 2);

    RETURN ROUND(v_subtotal + v_tax_amount - v_discount_amount, 2);
END;
$$;

/* =========================================================
   4. PROCEDURES
   ========================================================= */

CREATE OR REPLACE PROCEDURE book_appointment_5k(
    IN p_patient_id INT,
    IN p_doctor_id INT,
    IN p_appointment_date DATE,
    IN p_appointment_time TIME,
    IN p_reason_for_visit TEXT DEFAULT NULL,
    IN p_status TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    next_appointment_id INT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM patients_5k WHERE patient_id = p_patient_id
    ) THEN
        RAISE EXCEPTION 'Patient % does not exist.', p_patient_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM doctors_5k WHERE doctor_id = p_doctor_id
    ) THEN
        RAISE EXCEPTION 'Doctor % does not exist.', p_doctor_id;
    END IF;

    SELECT COALESCE(MAX(appointment_id), 0) + 1
    INTO next_appointment_id
    FROM appointments_5k;

    INSERT INTO appointments_5k (
        appointment_id,
        patient_id,
        doctor_id,
        appointment_date,
        appointment_time,
        status,
        reason_for_visit,
        created_at
    )
    VALUES (
        next_appointment_id,
        p_patient_id,
        p_doctor_id,
        p_appointment_date,
        p_appointment_time,
        p_status,
        p_reason_for_visit,
        NOW()
    );
END;
$$;

CREATE OR REPLACE PROCEDURE cancel_appointment_5k(
    IN p_appointment_id INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT LOWER(status)
    INTO v_status
    FROM appointments_5k
    WHERE appointment_id = p_appointment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment % does not exist.', p_appointment_id;
    END IF;

    IF v_status = 'completed' THEN
        RAISE EXCEPTION 'Completed appointment % cannot be cancelled.', p_appointment_id;
    END IF;

    IF v_status = 'cancelled' THEN
        RAISE EXCEPTION 'Appointment % is already cancelled.', p_appointment_id;
    END IF;

    UPDATE appointments_5k
    SET status = 'cancelled'
    WHERE appointment_id = p_appointment_id;
END;
$$;

CREATE OR REPLACE PROCEDURE complete_checkout_5k(
    IN p_appointment_id INT,
    IN p_medication_name VARCHAR(100),
    IN p_dosage VARCHAR(50),
    IN p_consultation_fee NUMERIC(10,2),
    IN p_medicine_charges NUMERIC(10,2),
    IN p_lab_charges NUMERIC(10,2),
    IN p_payment_method VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
    next_prescription_id INT;
    next_bill_id INT;
    v_item_cost NUMERIC(10,2);
    v_subtotal NUMERIC(10,2) := 0;
    total_amount NUMERIC(10,2);
    checkout_item_cursor CURSOR FOR
        SELECT item_cost
        FROM (
            SELECT COALESCE(p_consultation_fee, 0)::NUMERIC(10,2) AS item_cost, 
            p_appointment_id AS appointment_id
            
            UNION ALL
            SELECT COALESCE(p_medicine_charges, 0)::NUMERIC(10,2), 
            p_appointment_id
            
            UNION ALL
            SELECT COALESCE(p_lab_charges, 0)::NUMERIC(10,2), p_appointment_id
        ) AS service_items
        WHERE appointment_id = p_appointment_id
          AND item_cost > 0;    
BEGIN
    SELECT LOWER(status)
    INTO v_status
    FROM appointments_5k
    WHERE appointment_id = p_appointment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment % does not exist.', p_appointment_id;
    END IF;

    IF v_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cancelled appointment % cannot be checked out.', p_appointment_id;
    END IF;

    IF v_status = 'completed' THEN
        RAISE EXCEPTION 'Appointment % is already completed.', p_appointment_id;
    END IF;

    OPEN checkout_item_cursor;

    LOOP
        FETCH checkout_item_cursor INTO v_item_cost;
        EXIT WHEN NOT FOUND;

        v_subtotal := v_subtotal + COALESCE(v_item_cost, 0);
    END LOOP;

    CLOSE checkout_item_cursor;

    total_amount := calculate_checkout_total_5k(v_subtotal);

    UPDATE appointments_5k
    SET status = 'completed'
    WHERE appointment_id = p_appointment_id;

    SELECT nextval('prescription_5k_id_seq')
    INTO next_prescription_id;

    INSERT INTO prescriptions_5k (
        prescription_id,
        appointment_id,
        medication_name,
        dosage,
        issued_date
    )
    VALUES (
        next_prescription_id,
        p_appointment_id,
        p_medication_name,
        p_dosage,
        CURRENT_DATE
    );

    SELECT nextval('billing_5k_id_seq')
    INTO next_bill_id;

    INSERT INTO billing_5k (
        bill_id,
        appointment_id,
        consultation_fee,
        medicine_charges,
        lab_charges,
        total_amount,
        payment_status,
        payment_method,
        bill_date
    )
    VALUES (
        next_bill_id,
        p_appointment_id,
        COALESCE(p_consultation_fee, 0),
        COALESCE(p_medicine_charges, 0),
        COALESCE(p_lab_charges, 0),
        total_amount,
        'Paid',
        COALESCE(p_payment_method, 'Cash'),
        NOW()
    );
END;
$$;

/* =========================================================
   5. TRIGGERS
   ========================================================= */

DROP TRIGGER IF EXISTS trg_validate_appointment_rules_5k
ON appointments_5k;

CREATE TRIGGER trg_validate_appointment_rules_5k
BEFORE INSERT OR UPDATE ON appointments_5k
FOR EACH ROW
EXECUTE FUNCTION validate_appointment_rules();

DROP TRIGGER IF EXISTS trg_validate_patient_date_of_birth_5k
ON patients_5k;

CREATE TRIGGER trg_validate_patient_date_of_birth_5k
BEFORE INSERT OR UPDATE ON patients_5k
FOR EACH ROW
EXECUTE FUNCTION validate_patient_date_of_birth_5k();

DROP TRIGGER IF EXISTS trg_prevent_duplicate_patient_5k
ON patients_5k;

CREATE TRIGGER trg_prevent_duplicate_patient_5k
BEFORE INSERT OR UPDATE ON patients_5k
FOR EACH ROW
EXECUTE FUNCTION prevent_duplicate_patient_5k();




-- patients_5k.gender
ALTER TABLE patients_5k
ADD CONSTRAINT chk_patients_5k_gender
CHECK (LOWER(gender) IN ('male', 'female'));

-- patients_5k.blood_group
ALTER TABLE patients_5k
ADD CONSTRAINT chk_patients_5k_blood_group
CHECK (blood_group IN ('A+','A-','B+','B-','O+','O-','AB+','AB-'));

-- appointments_5k.appointment_time
ALTER TABLE appointments_5k
ADD CONSTRAINT chk_appointments_5k_time
CHECK (
    appointment_time >= TIME '09:00:00'
    AND appointment_time < TIME '17:00:00'
);

-- billing_5k.payment_status
ALTER TABLE billing_5k
ADD CONSTRAINT chk_billing_5k_payment_status
CHECK (LOWER(payment_status) IN ('paid', 'pending'));

-- billing_5k.payment_method
ALTER TABLE billing_5k
ADD CONSTRAINT chk_billing_5k_payment_method
CHECK (LOWER(payment_method) IN ('cash', 'card', 'upi'));

-- billing_5k.consultation_fee
ALTER TABLE billing_5k
ADD CONSTRAINT chk_billing_5k_consultation_fee
CHECK (consultation_fee >= 0);

-- billing_5k.medicine_charges
ALTER TABLE billing_5k
ADD CONSTRAINT chk_billing_5k_medicine_charges
CHECK (medicine_charges >= 0);

-- billing_5k.lab_charges
ALTER TABLE billing_5k
ADD CONSTRAINT chk_billing_5k_lab_charges
CHECK (lab_charges >= 0);

-- billing_5k.total_amount
ALTER TABLE billing_5k
ADD CONSTRAINT chk_billing_5k_total_amount
CHECK (total_amount >= 0);

-- doctors_5k.years_of_experience
ALTER TABLE doctors_5k
ADD CONSTRAINT chk_doctors_5k_experience
CHECK (years_of_experience >= 0 AND years_of_experience <= 60);

-- prescriptions_5k.duration_days
ALTER TABLE prescriptions_5k
ADD CONSTRAINT chk_prescriptions_5k_duration
CHECK (duration_days > 0);


ALTER TABLE doctors_5k
ADD CONSTRAINT uq_doctors_5k_license_number UNIQUE (license_number);

ALTER TABLE billing_5k
ADD CONSTRAINT uq_billing_5k_appointment_id UNIQUE (appointment_id);

ALTER TABLE prescriptions_5k
ADD CONSTRAINT uq_prescriptions_5k_appointment_id UNIQUE (appointment_id);

ALTER TABLE doctor_specializations_5k
ADD CONSTRAINT uq_doctor_specializations_5k UNIQUE (doctor_id, specialization);


-- doctors_5k: duplicate license_number
DELETE FROM doctors_5k
WHERE doctor_id IN (
    SELECT doctor_id
    FROM (
        SELECT doctor_id,
               ROW_NUMBER() OVER (PARTITION BY license_number ORDER BY doctor_id) AS rn
        FROM doctors_5k
        WHERE license_number IS NOT NULL
    ) t
    WHERE t.rn > 1
);

-- billing_5k: duplicate appointment_id
DELETE FROM billing_5k
WHERE bill_id IN (
    SELECT bill_id
    FROM (
        SELECT bill_id,
               ROW_NUMBER() OVER (PARTITION BY appointment_id ORDER BY bill_id) AS rn
        FROM billing_5k
        WHERE appointment_id IS NOT NULL
    ) t
    WHERE t.rn > 1
);

-- prescriptions_5k: duplicate appointment_id
DELETE FROM prescriptions_5k
WHERE prescription_id IN (
    SELECT prescription_id
    FROM (
        SELECT prescription_id,
               ROW_NUMBER() OVER (PARTITION BY appointment_id ORDER BY prescription_id) AS rn
        FROM prescriptions_5k
        WHERE appointment_id IS NOT NULL
    ) t
    WHERE t.rn > 1
);

-- doctor_specializations_5k: duplicate (doctor_id, specialization)
DELETE FROM doctor_specializations_5k
WHERE ctid IN (
    SELECT ctid
    FROM (
        SELECT ctid,
               ROW_NUMBER() OVER (
                   PARTITION BY doctor_id, specialization
                   ORDER BY ctid
               ) AS rn
        FROM doctor_specializations_5k
    ) t
    WHERE t.rn > 1
);


SELECT COUNT(DISTINCT a1.appointment_id) AS appointments_to_delete
FROM appointments_5k a1
JOIN appointments_5k a2
  ON a1.doctor_id = a2.doctor_id
 AND a1.appointment_date = a2.appointment_date
 AND a1.appointment_id > a2.appointment_id
 AND ABS(EXTRACT(EPOCH FROM (a1.appointment_time - a2.appointment_time))) < 1800;
