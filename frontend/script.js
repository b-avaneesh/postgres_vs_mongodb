let user = JSON.parse(localStorage.getItem('hospitalUser') || 'null');
let selectedPatient = null;
let selectedDoctor = null;
let doctorToDelete = null;
let selectedDirectoryPatient = null;
let selectedAppointmentToDelete = null;
let patientSearchTimer = null;
let doctorSearchTimer = null;
let deleteDoctorSearchTimer = null;
let patientDirectorySearchTimer = null;
let appointmentsSearchTimer = null;
let billingSearchTimer = null;
let prescriptionsSearchTimer = null;
let workloadSearchTimer = null;
let patientsPageState = { page: 1, total: 0, limit: 20, term: '' };
let appointmentsPageState = { page: 1, total: 0, limit: 10, term: '' };
let revenuePageState = { page: 1, total: 0, limit: 10 };
let workloadPageState = { page: 1, total: 0, limit: 10 };
let billingPageState = { page: 1, total: 0, limit: 10, term: '' };
let prescriptionsPageState = { page: 1, total: 0, limit: 10, term: '' };

function authHeaders() {
  if (!user) return {};
  return {
    'x-user-id': String(user.user_id),
    'x-username': user.username,
    'x-user-role': user.role
  };
}

async function apiFetch(url, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...authHeaders(),
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function ensureRole(expectedRole) {
  if (!user) {
    window.location.href = '/login.html';
    return false;
  }

  if (expectedRole === 'admin' && !['admin', 'superadmin'].includes(user.role)) {
    localStorage.removeItem('hospitalUser');
    window.location.href = '/login.html';
    return false;
  }

  if (expectedRole === 'superadmin' && user.role !== 'superadmin') {
    localStorage.removeItem('hospitalUser');
    window.location.href = '/login.html';
    return false;
  }

  return true;
}

function setMessage(id, message, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message || '';
  el.style.color = isError ? '#b42318' : '#0d7c6e';
}

function buildDisplayName(row) {
  return `${row.first_name || ''} ${row.last_name || ''}`.trim();
}

function getPhone(row) {
  return row.phone || row.phone_number || '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(dateValue, timeValue) {
  const datePart = formatDate(dateValue);
  return timeValue ? `${datePart} at ${timeValue}` : datePart;
}

function buildAppointmentSummary(row) {
  if (!row?.next_appointment_date || !row?.next_appointment_time) {
    return 'No upcoming appointment';
  }
  return `Next visit: ${formatDateTime(row.next_appointment_date, row.next_appointment_time)}`;
}

function renderRows(targetId, rows, columns, transform = (row, col) => row[col] ?? '') {
  const tbody = document.getElementById(targetId);
  if (!tbody) return;
  tbody.innerHTML = rows.map((row) => `
    <tr>${columns.map((col) => `<td>${transform(row, col)}</td>`).join('')}</tr>
  `).join('');
}

function updatePagination(labelId, prevId, nextId, state) {
  const label = document.getElementById(labelId);
  const prev = document.getElementById(prevId);
  const next = document.getElementById(nextId);
  const totalPages = Math.max(1, Math.ceil(state.total / state.limit));

  if (label) {
    label.textContent = `Page ${state.page} of ${totalPages} · ${state.total} records`;
  }
  if (prev) prev.disabled = state.page <= 1;
  if (next) next.disabled = state.page >= totalPages;
}

function renderPatientDetail(patient) {
  const detail = document.getElementById('patient-detail');
  if (!detail) return;

  const appointments = Array.isArray(patient.appointments)
    ? patient.appointments.filter((entry) => entry && entry.appointment_id)
    : [];

  detail.innerHTML = `
    <div>
      <p class="eyebrow">Patient Profile</p>
      <h4>${escapeHtml(buildDisplayName(patient) || 'Patient record')}</h4>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><span>Date of Birth</span><strong>${escapeHtml(formatDate(patient.date_of_birth))}</strong></div>
      <div class="detail-item"><span>Gender</span><strong>${escapeHtml(patient.gender || 'Not available')}</strong></div>
      <div class="detail-item"><span>Phone</span><strong>${escapeHtml(getPhone(patient) || 'Not available')}</strong></div>
      <div class="detail-item"><span>Email</span><strong>${escapeHtml(patient.email || 'Not available')}</strong></div>
      <div class="detail-item"><span>Address</span><strong>${escapeHtml(patient.address || 'Not available')}</strong></div>
      <div class="detail-item"><span>Blood Group</span><strong>${escapeHtml(patient.blood_group || 'Not available')}</strong></div>
    </div>
    <div>
      <h4>Appointment History</h4>
      <div class="history-list">
        ${appointments.length ? appointments.map((appointment) => `
          <article class="history-card">
            <strong>${escapeHtml(appointment.doctor_name || 'Doctor not assigned')}</strong>
            <p class="muted">${escapeHtml(formatDateTime(appointment.appointment_date, appointment.appointment_time))}</p>
            <span class="status-pill">${escapeHtml((appointment.status || 'scheduled').toLowerCase())}</span>
            <button type="button" class="secondary-action appointment-delete-button" data-appointment-id="${appointment.appointment_id}">
              Delete Appointment
            </button>
          </article>
        `).join('') : '<p class="muted">No appointments recorded for this patient yet.</p>'}
      </div>
    </div>
  `;

  detail.querySelectorAll('[data-appointment-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const appointmentId = button.dataset.appointmentId;
      selectedAppointmentToDelete = appointmentId;
      const confirmed = window.confirm(`Delete appointment ${appointmentId} for ${buildDisplayName(patient)}?`);
      if (!confirmed) return;

      try {
        await apiFetch(`/appointments/${appointmentId}`, { method: 'DELETE' });
        setMessage('patient-directory-message', 'Appointment deleted successfully');
        await showPatientDetail(patient.patient_id);
        await loadPatientDirectory(patientsPageState.page);
      } catch (error) {
        setMessage('patient-directory-message', error.message, true);
      }
    });
  });
}

function resetPatientDetail(message = 'Select a patient record to see their appointment history.') {
  selectedDirectoryPatient = null;
  selectedAppointmentToDelete = null;
  const detail = document.getElementById('patient-detail');
  if (detail) detail.textContent = message;
}

async function showPatientDetail(patientId) {
  try {
    const patient = await apiFetch(`/patients/${patientId}`);
    selectedDirectoryPatient = patient;
    renderPatientDetail(patient);
  } catch (error) {
    resetPatientDetail(error.message);
  }
}

function activateTab(targetId) {
  document.querySelectorAll('.tab-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.tabTarget === targetId);
  });
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === targetId);
  });
}

function bindTabs() {
  document.querySelectorAll('.tab-button').forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tabTarget));
  });
  document.querySelectorAll('[data-tab-jump]').forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.tabJump));
  });
}

function hideSearchResults() {
  const results = document.getElementById('patient-search-results');
  if (!results) return;
  results.innerHTML = '';
  results.classList.add('hidden');
}

function hideDoctorResults() {
  const results = document.getElementById('doctor-search-results');
  if (!results) return;
  results.innerHTML = '';
  results.classList.add('hidden');
}

function hideDeleteDoctorResults() {
  const results = document.getElementById('delete-doctor-results');
  if (!results) return;
  results.innerHTML = '';
  results.classList.add('hidden');
}

function setSelectedPatient(patient) {
  selectedPatient = patient;
  const hiddenField = document.getElementById('selected-patient-id');
  const card = document.getElementById('selected-patient-card');
  const name = document.getElementById('selected-patient-name');
  const meta = document.getElementById('selected-patient-meta');
  const input = document.getElementById('patient-search-input');

  if (hiddenField) hiddenField.value = patient.patient_id;
  if (input) input.value = buildDisplayName(patient);
  if (card && name && meta) {
    name.textContent = buildDisplayName(patient);
    meta.textContent = [getPhone(patient), patient.email, buildAppointmentSummary(patient)].filter(Boolean).join(' | ');
    card.classList.remove('hidden');
  }

  hideSearchResults();
}

function resetSelectedPatient() {
  selectedPatient = null;
  const hiddenField = document.getElementById('selected-patient-id');
  const card = document.getElementById('selected-patient-card');
  if (hiddenField) hiddenField.value = '';
  if (card) card.classList.add('hidden');
}

function resetSelectedDoctor() {
  selectedDoctor = null;
  const hiddenField = document.getElementById('selected-doctor-id');
  const card = document.getElementById('selected-doctor-card');
  const availability = document.getElementById('doctor-availability-message');
  if (hiddenField) hiddenField.value = '';
  if (card) card.classList.add('hidden');
  if (availability) availability.textContent = '';
}

function resetDoctorToDelete() {
  doctorToDelete = null;
  const card = document.getElementById('delete-doctor-card');
  if (card) card.classList.add('hidden');
}

function renderSearchResults(matches) {
  const results = document.getElementById('patient-search-results');
  if (!results) return;

  if (!matches.length) {
    results.innerHTML = '<div class="search-result-item muted">No matching patients found.</div>';
    results.classList.remove('hidden');
    return;
  }

  results.innerHTML = matches.map((patient) => `
    <button type="button" class="search-result-item" data-patient-id="${patient.patient_id}">
      <strong>${escapeHtml(buildDisplayName(patient))}</strong>
      <span>${escapeHtml([getPhone(patient) || 'No phone', patient.email || 'No email'].join(' | '))}</span>
      <span class="muted">${escapeHtml(buildAppointmentSummary(patient))}</span>
    </button>
  `).join('');

  results.classList.remove('hidden');
  results.querySelectorAll('[data-patient-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const patient = matches.find((row) => String(row.patient_id) === button.dataset.patientId);
      if (patient) setSelectedPatient(patient);
    });
  });
}

async function searchPatients(term) {
  const normalized = term.trim();
  if (!normalized) {
    resetSelectedPatient();
    hideSearchResults();
    return;
  }

  const params = new URLSearchParams();
  if (normalized.includes('@')) {
    params.set('email', normalized);
  } else if (/^[+\d\s()-]+$/.test(normalized)) {
    params.set('phone', normalized);
  } else {
    params.set('name', normalized);
  }

  const matches = await apiFetch(`/patients/search?${params.toString()}`);
  renderSearchResults(matches);
}

async function loadDoctorsIntoSelect() {
  const departments = await apiFetch('/departments');
  ['department-select', 'delete-department-select'].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">All departments</option>' + departments.map((department) => `
      <option value="${department.department_id}">${escapeHtml(department.department_name)}</option>
    `).join('');
  });
}

function setSelectedDoctor(doctor) {
  selectedDoctor = doctor;
  const hiddenField = document.getElementById('selected-doctor-id');
  const card = document.getElementById('selected-doctor-card');
  const name = document.getElementById('selected-doctor-name');
  const meta = document.getElementById('selected-doctor-meta');
  const input = document.getElementById('doctor-search-input');

  if (hiddenField) hiddenField.value = doctor.doctor_id;
  if (input) input.value = `Dr. ${buildDisplayName(doctor)}`;
  if (card && name && meta) {
    name.textContent = `Dr. ${buildDisplayName(doctor)}`;
    meta.textContent = [doctor.department_name, doctor.specialization].filter(Boolean).join(' | ');
    card.classList.remove('hidden');
  }

  hideDoctorResults();
  checkSelectedDoctorAvailability();
}

function setDoctorToDelete(doctor) {
  doctorToDelete = doctor;
  const card = document.getElementById('delete-doctor-card');
  const name = document.getElementById('delete-doctor-name');
  const meta = document.getElementById('delete-doctor-meta');
  const input = document.getElementById('delete-doctor-search-input');

  if (input) input.value = `Dr. ${buildDisplayName(doctor)}`;
  if (card && name && meta) {
    name.textContent = `Dr. ${buildDisplayName(doctor)}`;
    meta.textContent = [doctor.department_name, doctor.specialization].filter(Boolean).join(' | ');
    card.classList.remove('hidden');
  }

  hideDeleteDoctorResults();
}

async function searchDoctors(term) {
  const results = document.getElementById('doctor-search-results');
  if (!results) return;

  const normalized = term.trim();
  const departmentId = document.getElementById('department-select')?.value || '';
  const appointmentDate = document.querySelector('input[name="appointment_date"]')?.value || '';
  const appointmentTime = document.querySelector('input[name="appointment_time"]')?.value || '';

  if (!normalized && !departmentId) {
    resetSelectedDoctor();
    hideDoctorResults();
    return;
  }

  const params = new URLSearchParams();
  if (normalized) params.set('name', normalized);
  if (departmentId) params.set('department_id', departmentId);
  if (appointmentDate) params.set('appointment_date', appointmentDate);
  if (appointmentTime) params.set('appointment_time', appointmentTime);

  const doctors = await apiFetch(`/doctors/search?${params.toString()}`);

  if (!doctors.length) {
    results.innerHTML = '<div class="search-result-item muted">No matching doctors found for this filter.</div>';
    results.classList.remove('hidden');
    return;
  }

  results.innerHTML = doctors.map((doctor) => `
    <button type="button" class="search-result-item" data-doctor-id="${doctor.doctor_id}">
      <strong>Dr. ${escapeHtml(buildDisplayName(doctor))}</strong>
      <span>${escapeHtml([doctor.department_name, doctor.specialization].filter(Boolean).join(' | '))}</span>
      <span class="muted">${doctor.is_available ? 'Available for selected slot' : 'Busy in selected slot'}</span>
    </button>
  `).join('');

  results.classList.remove('hidden');
  results.querySelectorAll('[data-doctor-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const doctor = doctors.find((row) => String(row.doctor_id) === button.dataset.doctorId);
      if (doctor) setSelectedDoctor(doctor);
    });
  });
}

async function searchDoctorsForDeletion(term) {
  const results = document.getElementById('delete-doctor-results');
  if (!results) return;

  const normalized = term.trim();
  const departmentId = document.getElementById('delete-department-select')?.value || '';

  if (!normalized && !departmentId) {
    resetDoctorToDelete();
    hideDeleteDoctorResults();
    return;
  }

  const params = new URLSearchParams();
  if (normalized) params.set('name', normalized);
  if (departmentId) params.set('department_id', departmentId);

  const doctors = await apiFetch(`/doctors/search?${params.toString()}`);

  if (!doctors.length) {
    results.innerHTML = '<div class="search-result-item muted">No doctors match this filter.</div>';
    results.classList.remove('hidden');
    return;
  }

  results.innerHTML = doctors.map((doctor) => `
    <button type="button" class="search-result-item" data-delete-doctor-id="${doctor.doctor_id}">
      <strong>Dr. ${escapeHtml(buildDisplayName(doctor))}</strong>
      <span>${escapeHtml([doctor.department_name, doctor.specialization].filter(Boolean).join(' | '))}</span>
    </button>
  `).join('');

  results.classList.remove('hidden');
  results.querySelectorAll('[data-delete-doctor-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const doctor = doctors.find((row) => String(row.doctor_id) === button.dataset.deleteDoctorId);
      if (doctor) setDoctorToDelete(doctor);
    });
  });
}

async function checkSelectedDoctorAvailability() {
  const availability = document.getElementById('doctor-availability-message');
  if (!availability || !selectedDoctor?.doctor_id) return;

  const appointmentDate = document.querySelector('input[name="appointment_date"]')?.value;
  const appointmentTime = document.querySelector('input[name="appointment_time"]')?.value;

  if (!appointmentDate || !appointmentTime) {
    availability.textContent = 'Choose date and time to verify availability.';
    availability.style.color = '#6a766f';
    return;
  }

  try {
    const result = await apiFetch(`/doctors/${selectedDoctor.doctor_id}/availability?appointment_date=${appointmentDate}&appointment_time=${appointmentTime}`);
    const bookedSlots = Array.isArray(result.booked_slots) && result.booked_slots.length
      ? ` Booked on ${formatDate(result.appointment_date)}: ${result.booked_slots.join(', ')}.`
      : ` No other bookings on ${formatDate(result.appointment_date)}.`;
    availability.textContent = result.is_available
      ? `Doctor is available for this slot.${bookedSlots}`
      : `Doctor is already booked for this slot.${bookedSlots}`;
    availability.style.color = result.is_available ? '#0d7c6e' : '#b42318';
  } catch (error) {
    availability.textContent = error.message;
    availability.style.color = '#b42318';
  }
}

function bindLoginPage() {
  const form = document.getElementById('login-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('login-error', '');
    const payload = {
      username: document.getElementById('username').value.trim(),
      password: document.getElementById('password').value
    };

    try {
      const loggedInUser = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      localStorage.setItem('hospitalUser', JSON.stringify(loggedInUser));
      user = loggedInUser;
      window.location.href = loggedInUser.role === 'superadmin' ? '/admin-dashboard.html' : '/dashboard.html';
    } catch (error) {
      setMessage('login-error', error.message, true);
    }
  });
}

function bindHeaderActions() {
  const welcomeText = document.getElementById('welcome-text');
  if (welcomeText && user) {
    welcomeText.textContent = `${user.role === 'superadmin' ? 'Superadmin' : 'Admin'} session for ${user.username}`;
  }
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      localStorage.removeItem('hospitalUser');
      window.location.href = '/login.html';
    });
  }
}

function applyDateBoundaries() {
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[name="date_of_birth"]').forEach((input) => {
    input.max = today;
  });
}

function bindPatientSearch() {
  const input = document.getElementById('patient-search-input');
  if (!input) return;

  input.addEventListener('input', () => {
    clearTimeout(patientSearchTimer);
    patientSearchTimer = setTimeout(() => {
      searchPatients(input.value).catch((error) => {
        hideSearchResults();
        setMessage('appointment-form-message', error.message, true);
      });
    }, 220);
  });

  document.addEventListener('click', (event) => {
    const results = document.getElementById('patient-search-results');
    if (!results || results.contains(event.target) || event.target === input) return;
    hideSearchResults();
  });
}

function bindDoctorSearch() {
  const doctorInput = document.getElementById('doctor-search-input');
  const departmentSelect = document.getElementById('department-select');
  const appointmentDate = document.querySelector('input[name="appointment_date"]');
  const appointmentTime = document.querySelector('input[name="appointment_time"]');

  if (!doctorInput) return;

  const triggerSearch = () => {
    clearTimeout(doctorSearchTimer);
    doctorSearchTimer = setTimeout(() => {
      searchDoctors(doctorInput.value).catch((error) => {
        hideDoctorResults();
        setMessage('appointment-form-message', error.message, true);
      });
    }, 220);
  };

  doctorInput.addEventListener('input', () => {
    if (!doctorInput.value.trim()) resetSelectedDoctor();
    triggerSearch();
  });

  if (departmentSelect) {
    departmentSelect.addEventListener('change', () => {
      resetSelectedDoctor();
      triggerSearch();
    });
  }

  [appointmentDate, appointmentTime].forEach((field) => {
    if (field) {
      field.addEventListener('change', () => {
        triggerSearch();
        checkSelectedDoctorAvailability();
      });
    }
  });

  document.addEventListener('click', (event) => {
    const results = document.getElementById('doctor-search-results');
    if (!results || results.contains(event.target) || event.target === doctorInput) return;
    hideDoctorResults();
  });
}

function bindDeleteDoctorSearch() {
  const searchInput = document.getElementById('delete-doctor-search-input');
  const departmentSelect = document.getElementById('delete-department-select');

  if (!searchInput) return;

  const triggerSearch = () => {
    clearTimeout(deleteDoctorSearchTimer);
    deleteDoctorSearchTimer = setTimeout(() => {
      searchDoctorsForDeletion(searchInput.value).catch((error) => {
        hideDeleteDoctorResults();
        setMessage('doctor-delete-message', error.message, true);
      });
    }, 220);
  };

  searchInput.addEventListener('input', () => {
    if (!searchInput.value.trim()) resetDoctorToDelete();
    triggerSearch();
  });

  if (departmentSelect) {
    departmentSelect.addEventListener('change', () => {
      resetDoctorToDelete();
      triggerSearch();
    });
  }

  document.addEventListener('click', (event) => {
    const results = document.getElementById('delete-doctor-results');
    if (!results || results.contains(event.target) || event.target === searchInput) return;
    hideDeleteDoctorResults();
  });
}

function bindPatientForm() {
  const patientForm = document.getElementById('add-patient-form');
  if (!patientForm) return;
  patientForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(patientForm).entries());

    try {
      const result = await apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMessage('patient-form-message', 'Patient added successfully');
      patientForm.reset();
      setSelectedPatient({
        patient_id: result.patient_id,
        first_name: result.first_name,
        last_name: result.last_name,
        phone: result.phone || result.phone_number,
        email: result.email
      });
    } catch (error) {
      setMessage('patient-form-message', error.message, true);
    }
  });
}

function bindAppointmentForm() {
  const appointmentForm = document.getElementById('add-appointment-form');
  if (!appointmentForm) return;
  appointmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedPatient?.patient_id) {
      setMessage('appointment-form-message', 'Please search and select a patient first.', true);
      return;
    }

    const payload = Object.fromEntries(new FormData(appointmentForm).entries());
    if (!selectedDoctor?.doctor_id) {
      setMessage('appointment-form-message', 'Please search and select a doctor.', true);
      return;
    }

    payload.patient_id = Number(selectedPatient.patient_id);
    payload.doctor_id = Number(selectedDoctor.doctor_id);

    try {
      const availability = await apiFetch(`/doctors/${selectedDoctor.doctor_id}/availability?appointment_date=${payload.appointment_date}&appointment_time=${payload.appointment_time}`);
      if (!availability.is_available) {
        setMessage('appointment-form-message', 'Selected doctor is not available for that slot.', true);
        return;
      }
    } catch (error) {
      setMessage('appointment-form-message', error.message, true);
      return;
    }

    try {
      await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setMessage('appointment-form-message', 'Appointment booked successfully');
      appointmentForm.reset();
      document.getElementById('selected-patient-id').value = selectedPatient.patient_id;
      document.getElementById('selected-doctor-id').value = selectedDoctor.doctor_id;
      checkSelectedDoctorAvailability();
    } catch (error) {
      setMessage('appointment-form-message', error.message, true);
    }
  });
}

function buildPatientQuery(term, page, limit) {
  const params = new URLSearchParams();
  if (term) {
    if (term.includes('@')) {
      params.set('email', term);
    } else if (/^[+\d\s()-]+$/.test(term)) {
      params.set('phone', term);
    } else {
      params.set('name', term);
    }
  }
  params.set('page', String(page));
  params.set('limit', String(limit));
  return params.toString();
}

async function loadPatientDirectory(page = 1) {
  const term = document.getElementById('patient-directory-search')?.value.trim() || '';
  const query = buildPatientQuery(term, page, patientsPageState.limit);
  const data = await apiFetch(`/patients?${query}`);
  const tbody = document.getElementById('patients-table-body');
  if (!tbody) return;

  patientsPageState = { ...patientsPageState, page: data.page, total: data.total, limit: data.limit, term };
  tbody.innerHTML = data.items.map((row) => `
    <tr class="clickable-row" data-patient-id="${row.patient_id}">
      <td>${escapeHtml(buildDisplayName(row))}</td>
      <td>${escapeHtml(getPhone(row))}</td>
      <td>${escapeHtml(row.email || '')}</td>
    </tr>
  `).join('');

  if (!data.items.length) {
    tbody.innerHTML = '<tr><td colspan="3" class="muted">No patients match this search.</td></tr>';
    resetPatientDetail('No patient selected.');
  }

  tbody.querySelectorAll('[data-patient-id]').forEach((tableRow) => {
    tableRow.addEventListener('click', () => {
      showPatientDetail(tableRow.dataset.patientId);
    });
  });

  updatePagination('patients-page-label', 'patients-prev-page', 'patients-next-page', patientsPageState);
}

async function loadAppointments(page = 1) {
  const term = document.getElementById('appointments-search-input')?.value.trim() || '';
  const startDate = document.getElementById('appointments-start-date')?.value || '';
  const endDate = document.getElementById('appointments-end-date')?.value || '';
  const params = new URLSearchParams({
    page: String(page),
    limit: String(appointmentsPageState.limit)
  });
  if (term) params.set('q', term);
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const data = await apiFetch(`/appointments?${params.toString()}`);
  appointmentsPageState = { ...appointmentsPageState, page: data.page, total: data.total, limit: data.limit, term, startDate, endDate };

  const tbody = document.getElementById('appointments-table-body');
  if (!tbody) return;

  tbody.innerHTML = data.items.map((row) => `
    <tr>
      <td>${escapeHtml(row.appointment_id)}</td>
      <td>${escapeHtml(row.patient_name || '')}</td>
      <td>${escapeHtml(row.doctor_name || '')}</td>
      <td>${escapeHtml(formatDate(row.appointment_date))}</td>
      <td>${escapeHtml(row.appointment_time || '')}</td>
      <td>${escapeHtml(row.status || '')}</td>
      <td><button type="button" class="danger appointment-row-delete" data-appointment-id="${row.appointment_id}">Delete</button></td>
    </tr>
  `).join('');

  if (!data.items.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">No appointments match this filter.</td></tr>';
  }

  tbody.querySelectorAll('[data-appointment-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const appointmentId = button.dataset.appointmentId;
      const confirmed = window.confirm(`Delete appointment ${appointmentId}? This will also remove linked prescription and billing records.`);
      if (!confirmed) return;

      try {
        await apiFetch(`/appointments/${appointmentId}`, { method: 'DELETE' });
        setMessage('appointments-message', 'Appointment deleted successfully');
        await loadAppointments(appointmentsPageState.page);
        if (selectedDirectoryPatient?.patient_id) {
          await showPatientDetail(selectedDirectoryPatient.patient_id);
        }
      } catch (error) {
        setMessage('appointments-message', error.message, true);
      }
    });
  });

  updatePagination('appointments-page-label', 'appointments-prev-page', 'appointments-next-page', appointmentsPageState);
}

function bindPatientDirectory() {
  const loadPatientsButton = document.getElementById('load-patients-button');
  const searchInput = document.getElementById('patient-directory-search');
  const searchButton = document.getElementById('patient-directory-search-button');
  const prevButton = document.getElementById('patients-prev-page');
  const nextButton = document.getElementById('patients-next-page');
  const deleteButton = document.getElementById('delete-patient-button');

  const runSearch = (page = 1) => {
    loadPatientDirectory(page).catch((error) => {
      setMessage('patient-directory-message', error.message, true);
    });
  };

  if (loadPatientsButton) {
    loadPatientsButton.addEventListener('click', () => runSearch(1));
  }

  if (searchButton) {
    searchButton.addEventListener('click', () => runSearch(1));
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(patientDirectorySearchTimer);
      patientDirectorySearchTimer = setTimeout(() => runSearch(1), 260);
    });
  }

  if (prevButton) {
    prevButton.addEventListener('click', () => {
      if (patientsPageState.page > 1) runSearch(patientsPageState.page - 1);
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(patientsPageState.total / patientsPageState.limit));
      if (patientsPageState.page < totalPages) runSearch(patientsPageState.page + 1);
    });
  }

  if (deleteButton) {
    deleteButton.addEventListener('click', async () => {
      if (!selectedDirectoryPatient?.patient_id) {
        setMessage('patient-directory-message', 'Select a patient record first.', true);
        return;
      }

      const confirmed = window.confirm(`Remove ${buildDisplayName(selectedDirectoryPatient)} and their related records?`);
      if (!confirmed) return;

      try {
        await apiFetch(`/patients/${selectedDirectoryPatient.patient_id}`, { method: 'DELETE' });
        setMessage('patient-directory-message', 'Patient removed successfully');
        resetPatientDetail('Patient removed. Select another record to continue.');
        runSearch(patientsPageState.page);
      } catch (error) {
        setMessage('patient-directory-message', error.message, true);
      }
    });
  }
}

function bindAppointmentsDirectory() {
  const loadButton = document.getElementById('load-appointments-button');
  const searchInput = document.getElementById('appointments-search-input');
  const startDate = document.getElementById('appointments-start-date');
  const endDate = document.getElementById('appointments-end-date');
  const prevButton = document.getElementById('appointments-prev-page');
  const nextButton = document.getElementById('appointments-next-page');

  const runSearch = (page = 1) => {
    loadAppointments(page).catch((error) => {
      setMessage('appointments-message', error.message, true);
    });
  };

  if (loadButton) {
    loadButton.addEventListener('click', () => runSearch(1));
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(appointmentsSearchTimer);
      appointmentsSearchTimer = setTimeout(() => runSearch(1), 260);
    });
  }

  [startDate, endDate].forEach((field) => {
    if (field) {
      field.addEventListener('change', () => runSearch(1));
    }
  });

  if (prevButton) {
    prevButton.addEventListener('click', () => {
      if (appointmentsPageState.page > 1) runSearch(appointmentsPageState.page - 1);
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(appointmentsPageState.total / appointmentsPageState.limit));
      if (appointmentsPageState.page < totalPages) runSearch(appointmentsPageState.page + 1);
    });
  }
}

async function loadBilling(page = 1) {
  const term = document.getElementById('billing-search-input')?.value.trim() || '';
  const startDate = document.getElementById('billing-start-date')?.value || '';
  const endDate = document.getElementById('billing-end-date')?.value || '';
  const params = new URLSearchParams({
    page: String(page),
    limit: String(billingPageState.limit)
  });
  if (term) params.set('q', term);
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const data = await apiFetch(`/billing?${params.toString()}`);
  billingPageState = { ...billingPageState, page: data.page, total: data.total, limit: data.limit, term, startDate, endDate };

  renderRows(
    'billing-table-body',
    data.items,
    ['appointment_id', 'patient_name', 'doctor_name', 'total_amount', 'payment_status', 'payment_method'],
    (row, col) => escapeHtml(row[col] ?? '')
  );

  if (!data.items.length) {
    document.getElementById('billing-table-body').innerHTML = '<tr><td colspan="6" class="muted">No billing records match this search.</td></tr>';
  }

  updatePagination('billing-page-label', 'billing-prev-page', 'billing-next-page', billingPageState);
}

async function loadPrescriptions(page = 1) {
  const term = document.getElementById('prescriptions-search-input')?.value.trim() || '';
  const startDate = document.getElementById('prescriptions-start-date')?.value || '';
  const endDate = document.getElementById('prescriptions-end-date')?.value || '';
  const params = new URLSearchParams({
    page: String(page),
    limit: String(prescriptionsPageState.limit)
  });
  if (term) params.set('q', term);
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const data = await apiFetch(`/prescriptions?${params.toString()}`);
  prescriptionsPageState = { ...prescriptionsPageState, page: data.page, total: data.total, limit: data.limit, term, startDate, endDate };

  renderRows(
    'prescriptions-table-body',
    data.items,
    ['appointment_id', 'patient_name', 'doctor_name', 'medication_name', 'dosage', 'issued_date'],
    (row, col) => col === 'issued_date' ? escapeHtml(formatDate(row[col])) : escapeHtml(row[col] ?? '')
  );

  if (!data.items.length) {
    document.getElementById('prescriptions-table-body').innerHTML = '<tr><td colspan="6" class="muted">No prescriptions match this search.</td></tr>';
  }

  updatePagination('prescriptions-page-label', 'prescriptions-prev-page', 'prescriptions-next-page', prescriptionsPageState);
}

async function loadRevenue(page = 1) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(revenuePageState.limit)
  });
  const department = document.getElementById('revenue-department-filter')?.value.trim() || '';
  const startDate = document.getElementById('revenue-start-date')?.value || '';
  const endDate = document.getElementById('revenue-end-date')?.value || '';
  if (department) params.set('department', department);
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const data = await apiFetch(`/analytics/revenue-report?${params.toString()}`);
  revenuePageState = { ...revenuePageState, page: data.page, total: data.total, limit: data.limit, department, startDate, endDate };

  renderRows(
    'revenue-table-body',
    data.items,
    ['doctor_name', 'department_name', 'total_appointments', 'total_revenue'],
    (row, col) => escapeHtml(row[col] ?? '')
  );

  if (!data.items.length) {
    document.getElementById('revenue-table-body').innerHTML = '<tr><td colspan="4" class="muted">No revenue records match this filter.</td></tr>';
  }

  updatePagination('revenue-page-label', 'revenue-prev-page', 'revenue-next-page', revenuePageState);
}

async function loadWorkload(page = 1) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(workloadPageState.limit)
  });
  const doctorName = document.getElementById('workload-doctor-filter')?.value.trim() || '';
  const department = document.getElementById('workload-department-filter')?.value.trim() || '';
  const startDate = document.getElementById('workload-start-date')?.value || '';
  const endDate = document.getElementById('workload-end-date')?.value || '';
  if (doctorName) params.set('doctor_name', doctorName);
  if (department) params.set('department', department);
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  const data = await apiFetch(`/analytics/doctor-workload?${params.toString()}`);
  workloadPageState = { ...workloadPageState, page: data.page, total: data.total, limit: data.limit, doctorName, department, startDate, endDate };

  renderRows(
    'workload-table-body',
    data.items,
    ['doctor_name', 'department_name', 'specialization', 'unique_patients', 'total_appointments', 'completed_appointments', 'scheduled_appointments'],
    (row, col) => escapeHtml(row[col] ?? '')
  );

  if (!data.items.length) {
    document.getElementById('workload-table-body').innerHTML = '<tr><td colspan="7" class="muted">No workload records match this filter.</td></tr>';
  }

  updatePagination('workload-page-label', 'workload-prev-page', 'workload-next-page', workloadPageState);
}

function bindSuperadminActions() {
  const loadRevenueButton = document.getElementById('load-revenue-button');
  const revenueDepartment = document.getElementById('revenue-department-filter');
  const revenueStartDate = document.getElementById('revenue-start-date');
  const revenueEndDate = document.getElementById('revenue-end-date');
  const revenuePrev = document.getElementById('revenue-prev-page');
  const revenueNext = document.getElementById('revenue-next-page');
  if (loadRevenueButton) {
    loadRevenueButton.addEventListener('click', () => {
      loadRevenue(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
    });
  }

  [revenueDepartment, revenueStartDate, revenueEndDate].forEach((field) => {
    if (field) {
      field.addEventListener('change', () => {
        loadRevenue(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      });
    }
  });

  if (revenuePrev) {
    revenuePrev.addEventListener('click', () => {
      if (revenuePageState.page > 1) {
        loadRevenue(revenuePageState.page - 1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      }
    });
  }

  if (revenueNext) {
    revenueNext.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(revenuePageState.total / revenuePageState.limit));
      if (revenuePageState.page < totalPages) {
        loadRevenue(revenuePageState.page + 1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      }
    });
  }

  const loadWorkloadButton = document.getElementById('load-workload-button');
  const workloadDoctor = document.getElementById('workload-doctor-filter');
  const workloadDepartment = document.getElementById('workload-department-filter');
  const workloadStartDate = document.getElementById('workload-start-date');
  const workloadEndDate = document.getElementById('workload-end-date');
  const workloadPrev = document.getElementById('workload-prev-page');
  const workloadNext = document.getElementById('workload-next-page');
  if (loadWorkloadButton) {
    loadWorkloadButton.addEventListener('click', () => {
      loadWorkload(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
    });
  }

  [workloadStartDate, workloadEndDate].forEach((field) => {
    if (field) {
      field.addEventListener('change', () => {
        loadWorkload(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      });
    }
  });

  [workloadDoctor, workloadDepartment].forEach((field) => {
    if (field) {
      field.addEventListener('input', () => {
        clearTimeout(workloadSearchTimer);
        workloadSearchTimer = setTimeout(() => {
          loadWorkload(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
        }, 260);
      });
    }
  });

  if (workloadPrev) {
    workloadPrev.addEventListener('click', () => {
      if (workloadPageState.page > 1) {
        loadWorkload(workloadPageState.page - 1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      }
    });
  }

  if (workloadNext) {
    workloadNext.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(workloadPageState.total / workloadPageState.limit));
      if (workloadPageState.page < totalPages) {
        loadWorkload(workloadPageState.page + 1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      }
    });
  }

  const deleteDoctorButton = document.getElementById('delete-doctor-button');
  if (deleteDoctorButton) {
    deleteDoctorButton.addEventListener('click', async () => {
      if (!doctorToDelete?.doctor_id) {
        setMessage('doctor-delete-message', 'Please search and select a doctor first.', true);
        return;
      }
      try {
        await apiFetch(`/doctors/${doctorToDelete.doctor_id}`, { method: 'DELETE' });
        setMessage('doctor-delete-message', 'Doctor deleted successfully');
        resetDoctorToDelete();
      } catch (error) {
        setMessage('doctor-delete-message', error.message, true);
      }
    });
  }

  const loadBillingButton = document.getElementById('load-billing-button');
  const billingSearchInput = document.getElementById('billing-search-input');
  const billingStartDate = document.getElementById('billing-start-date');
  const billingEndDate = document.getElementById('billing-end-date');
  const billingPrev = document.getElementById('billing-prev-page');
  const billingNext = document.getElementById('billing-next-page');

  if (loadBillingButton) {
    loadBillingButton.addEventListener('click', () => {
      loadBilling(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
    });
  }

  if (billingSearchInput) {
    billingSearchInput.addEventListener('input', () => {
      clearTimeout(billingSearchTimer);
      billingSearchTimer = setTimeout(() => {
        loadBilling(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      }, 260);
    });
  }

  [billingStartDate, billingEndDate].forEach((field) => {
    if (field) {
      field.addEventListener('change', () => {
        loadBilling(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      });
    }
  });

  if (billingPrev) {
    billingPrev.addEventListener('click', () => {
      if (billingPageState.page > 1) {
        loadBilling(billingPageState.page - 1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      }
    });
  }

  if (billingNext) {
    billingNext.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(billingPageState.total / billingPageState.limit));
      if (billingPageState.page < totalPages) {
        loadBilling(billingPageState.page + 1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      }
    });
  }

  const loadPrescriptionsButton = document.getElementById('load-prescriptions-button');
  const prescriptionsSearchInput = document.getElementById('prescriptions-search-input');
  const prescriptionsStartDate = document.getElementById('prescriptions-start-date');
  const prescriptionsEndDate = document.getElementById('prescriptions-end-date');
  const prescriptionsPrev = document.getElementById('prescriptions-prev-page');
  const prescriptionsNext = document.getElementById('prescriptions-next-page');

  if (loadPrescriptionsButton) {
    loadPrescriptionsButton.addEventListener('click', () => {
      loadPrescriptions(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
    });
  }

  if (prescriptionsSearchInput) {
    prescriptionsSearchInput.addEventListener('input', () => {
      clearTimeout(prescriptionsSearchTimer);
      prescriptionsSearchTimer = setTimeout(() => {
        loadPrescriptions(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      }, 260);
    });
  }

  [prescriptionsStartDate, prescriptionsEndDate].forEach((field) => {
    if (field) {
      field.addEventListener('change', () => {
        loadPrescriptions(1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      });
    }
  });

  if (prescriptionsPrev) {
    prescriptionsPrev.addEventListener('click', () => {
      if (prescriptionsPageState.page > 1) {
        loadPrescriptions(prescriptionsPageState.page - 1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      }
    });
  }

  if (prescriptionsNext) {
    prescriptionsNext.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(prescriptionsPageState.total / prescriptionsPageState.limit));
      if (prescriptionsPageState.page < totalPages) {
        loadPrescriptions(prescriptionsPageState.page + 1).catch((error) => setMessage('doctor-delete-message', error.message, true));
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  bindLoginPage();
  const dashboardType = document.body.dataset.dashboard;
  if (!dashboardType) return;
  if (!ensureRole(dashboardType)) return;

  bindHeaderActions();
  applyDateBoundaries();
  bindTabs();
  bindPatientSearch();
  bindDoctorSearch();
  bindDeleteDoctorSearch();
  bindPatientForm();
  bindAppointmentForm();
  bindAppointmentsDirectory();
  bindPatientDirectory();

  try {
    await loadDoctorsIntoSelect();
  } catch (error) {
    setMessage('appointment-form-message', error.message, true);
  }

  if (dashboardType === 'superadmin') {
    bindSuperadminActions();
  }
});
