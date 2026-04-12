let appointments = [];
let selectedAppointmentId = null;

const upcomingList = document.getElementById("upcoming-list");
const pastList = document.getElementById("past-list");
const upcomingCount = document.getElementById("upcoming-count");
const pastCount = document.getElementById("past-count");

const cancelDialog = document.getElementById("cancel-dialog");
const rescheduleDialog = document.getElementById("reschedule-dialog");

const BOOKINGS_URL = "/api/bookings/demo_patient_123";

// stores fake clinic names like:
// clinicIdA -> Clinic 1
// clinicIdB -> Clinic 2
const clinicNameMap = new Map();

async function fetchBookings() {
  try {
    const response = await fetch(BOOKINGS_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch bookings: ${response.status}`);
    }

    const data = await response.json();

    appointments = Array.isArray(data) ? data : (data.bookings || []);

    buildClinicNameMap();
  } catch (error) {
    console.error("Error loading bookings:", error);
    appointments = [];
  }
}

function buildClinicNameMap() {
  clinicNameMap.clear();

  let count = 1;

  appointments.forEach(appointment => {
    if (!clinicNameMap.has(appointment.clinicId)) {
      clinicNameMap.set(appointment.clinicId, `Clinic ${count}`);
      count++;
    }
  });
}

function getClinicName(clinicId) {
  return clinicNameMap.get(clinicId) || "Unknown Clinic";
}

function getAppointmentTime(appointment) {
  return appointment.timeSlot || "Time TBD";
}

function normalizeStatus(status) {
  return String(status || "").toLowerCase();
}

function formatDateParts(dateString) {
  const date = new Date(dateString);
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return { month, day, year };
}

function isToday(dateString) {
  const today = new Date();
  const date = new Date(dateString);

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isPast(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(dateString);
  return date < today;
}

function createEmptyState(title, text, buttonText) {
  const section = document.createElement("section");
  section.className = "empty-state";

  section.innerHTML = `
    <h3>${title}</h3>
    <p>${text}</p>
    ${buttonText ? `<a href="search.html" class="button primary">${buttonText}</a>` : ""}
  `;

  return section;
}

function createAppointmentCard(appointment, past = false) {
  const clinicName = getClinicName(appointment.clinicId);
  const time = getAppointmentTime(appointment);
  const dateParts = formatDateParts(appointment.date);

  const status = normalizeStatus(appointment.status);
  const cancelled = status === "cancelled";
  const today = isToday(appointment.date);

  const article = document.createElement("article");
  article.className = "appointment-card";

  if (past) article.classList.add("past");
  if (cancelled) article.classList.add("cancelled");
  if (today && !cancelled) article.classList.add("today");

  let statusClass = "confirmed";
  let statusText = "Booked";

  if (cancelled) {
    statusClass = "cancelled";
    statusText = "Cancelled";
  } else if (past) {
    statusClass = "completed";
    statusText = "Completed";
  }

  article.innerHTML = `
    <section class="appointment-main">
      <section class="appointment-date" aria-label="Appointment date">
        <p class="month">${dateParts.month}</p>
        <p class="day">${dateParts.day}</p>
        <p class="year">${dateParts.year}</p>
      </section>

      <section class="appointment-details">
        <header>
          <h3>
            ${clinicName}
            ${today && !cancelled ? `<span class="today-badge">Today</span>` : ""}
          </h3>
        </header>

        <section class="details-meta" aria-label="Appointment details">
          <p><strong>Clinic ID:</strong> ${appointment.clinicId}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Patient:</strong> ${appointment.patientId || "Unknown"}</p>
        </section>

        <p>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </p>
      </section>
    </section>
  `;

  if (!past && !cancelled) {
    const footer = document.createElement("footer");
    footer.className = "appointment-actions";
    footer.innerHTML = `
      <button type="button" class="button secondary reschedule-button">Reschedule</button>
      <button type="button" class="button danger cancel-button">Cancel</button>
    `;

    footer.querySelector(".cancel-button").addEventListener("click", () => {
      selectedAppointmentId = appointment.id;
      cancelDialog.showModal();
    });

    footer.querySelector(".reschedule-button").addEventListener("click", () => {
      selectedAppointmentId = appointment.id;
      rescheduleDialog.showModal();
    });

    article.appendChild(footer);
  }

  return article;
}

function renderAppointments() {
  upcomingList.innerHTML = "";
  pastList.innerHTML = "";

  const upcomingAppointments = appointments
    .filter(appt => normalizeStatus(appt.status) !== "cancelled" && !isPast(appt.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const pastAppointments = appointments
    .filter(appt => isPast(appt.date) || normalizeStatus(appt.status) === "cancelled")
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  upcomingCount.textContent = upcomingAppointments.length;
  pastCount.textContent = pastAppointments.length;

  if (appointments.length === 0) {
    upcomingList.appendChild(
      createEmptyState(
        "No appointments yet",
        "No bookings were found for this patient.",
        "Find a Clinic"
      )
    );

    pastList.appendChild(
      createEmptyState(
        "No past appointments",
        "Your appointment history will appear here.",
        ""
      )
    );
    return;
  }

  if (upcomingAppointments.length > 0) {
    upcomingAppointments.forEach(appt => {
      upcomingList.appendChild(createAppointmentCard(appt, false));
    });
  } else {
    upcomingList.appendChild(
      createEmptyState(
        "No upcoming appointments",
        "You don't have any scheduled visits.",
        "Find a Clinic"
      )
    );
  }

  if (pastAppointments.length > 0) {
    pastAppointments.forEach(appt => {
      pastList.appendChild(createAppointmentCard(appt, true));
    });
  } else {
    pastList.appendChild(
      createEmptyState(
        "No past appointments",
        "Your appointment history will appear here.",
        ""
      )
    );
  }
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".tab-panel");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(btn => btn.classList.remove("active"));
      panels.forEach(panel => panel.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(`${button.dataset.tab}-panel`).classList.add("active");
    });
  });
}

document.getElementById("cancel-close").addEventListener("click", () => {
  cancelDialog.close();
  selectedAppointmentId = null;
});

document.getElementById("cancel-confirm").addEventListener("click", () => {
  const appointment = appointments.find(appt => appt.id === selectedAppointmentId);

  if (appointment) {
    appointment.status = "cancelled";
  }

  cancelDialog.close();
  selectedAppointmentId = null;
  renderAppointments();
});

document.getElementById("reschedule-close").addEventListener("click", () => {
  rescheduleDialog.close();
  selectedAppointmentId = null;
});

document.getElementById("reschedule-confirm").addEventListener("click", () => {
  const appointment = appointments.find(appt => appt.id === selectedAppointmentId);

  if (appointment) {
    appointment.status = "cancelled";
    alert(`Reschedule booking for ${getClinicName(appointment.clinicId)} later.`);
  }

  rescheduleDialog.close();
  selectedAppointmentId = null;
  renderAppointments();
});

async function initAppointmentsPage() {
  setupTabs();
  await fetchBookings();
  renderAppointments();
}

initAppointmentsPage();