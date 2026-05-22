let appointments = [];
let selectedAppointmentId = null;

const upcomingList = document.getElementById("upcoming-list");
const pastList = document.getElementById("past-list");
const upcomingCount = document.getElementById("upcoming-count");
const pastCount = document.getElementById("past-count");

const cancelDialog = document.getElementById("cancel-dialog");
const rescheduleDialog = document.getElementById("reschedule-dialog");


// Loads all appointments for the patient id stored in localStorage.
async function fetchAppointments() {
  try {
    const patientId = localStorage.getItem("patientId");

    if (!patientId) {
        window.location.href = "index.html";
    }
    const APPOINTMENTS_URL = `/api/appointments/${patientId}`;
    const response = await fetch(APPOINTMENTS_URL);

    if (!response.ok) {
      throw new Error(`Failed to fetch appointments: ${response.status}`);
    }

    const data = await response.json();
    appointments = Array.isArray(data) ? data : (data.appointments || []);
  } catch (error) {
    console.error("Error loading appointments:", error);
    appointments = [];
  }
}

// Converts appointment status values to lowercase for consistent comparisons.
function normalizeStatus(status) {
  return String(status || "").toLowerCase();
}

// Splits a date string into the month/day/year pieces used by appointment
// cards.
function formatDateParts(dateString) {
  const date = new Date(dateString);
  if (isNaN(date)) return { month: "N/A", day: "--", year: "----" };
  
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return { month, day, year };
}

// Checks whether an appointment date is today in the browser's local time.
function isToday(dateString) {
  const today = new Date();
  const date = new Date(dateString);

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

// Checks whether an appointment date is before today.
function isPast(dateString) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(dateString);
  return date < today;
}

// Builds the reusable empty-state block shown when a list has no appointments.
function createEmptyState(title, text, buttonText) {
  const section = document.createElement("section");
  section.className = "empty-state-notice";

  section.innerHTML = `
    <h3>${title}</h3>
    <p>${text}</p>
    ${buttonText ? `<a href="dashboard.html" class="button-cta primary">${buttonText}</a>` : ""}
  `;

  return section;
}

// Builds one appointment card, including status styling and action buttons for
// active appointments.
function createAppointmentCard(appointment, past = false) {
  const clinicName = appointment.clinicName || "Unknown Clinic";
  const clinicAddress = appointment.clinicAddress || "Address not available";
  const time = appointment.timeSlot || "Time TBD";
  const dateParts = formatDateParts(appointment.date);

  const status = normalizeStatus(appointment.status);

  const cancelled = status === "cancelled";
  const missed = status === "missed";
  const completed = status === "completed";

  const today = isToday(appointment.date);

  const article = document.createElement("article");
  article.className = "appointment-entry";

  if (past || completed) {
    article.classList.add("state-past");
  }

  if (cancelled) {
    article.classList.add("state-cancelled");
  }

  if (missed) {
    article.classList.add("state-missed");
  }

  if (today && !cancelled && !missed && !completed) {
    article.classList.add("state-today");
  }

  let statusClass = "tag-confirmed";
  let statusText = "Confirmed";

  if (cancelled) {
    statusClass = "tag-cancelled";
    statusText = "Cancelled";
  } 
  else if (missed) {
    statusClass = "tag-missed";
    statusText = "Missed";
  } 
  else if (completed || past) {
    statusClass = "tag-completed";
    statusText = "Completed";
  }

  article.innerHTML = `
    <section class="entry-core">
      <time datetime="${appointment.date}" class="entry-calendar" aria-label="Appointment date">
        <span class="cal-month">${dateParts.month}</span>
        <span class="cal-day">${dateParts.day}</span>
        <span class="cal-year">${dateParts.year}</span>
      </time>

      <section class="entry-info">
        <header>
          <h3>
            ${clinicName}
            ${today && !cancelled && !missed && !completed
              ? `<mark class="badge-today">Today</mark>`
              : ""}
          </h3>
        </header>

        <section class="entry-metadata" aria-label="Appointment details">
          <address class="clinic-address">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${clinicAddress}
          </address>

          <p class="time-meta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Scheduled for ${time}
          </p>
        </section>

        <footer class="entry-status">
          <span class="status-indicator ${statusClass}">
            ${statusText}
          </span>
        </footer>
      </section>
    </section>
  `;

  const inactiveStatuses = ["cancelled", "completed", "missed"];

  if (!past && !inactiveStatuses.includes(status)) {
    const actions = document.createElement("nav");
    actions.className = "entry-actions";
    actions.setAttribute("aria-label", "Appointment actions");

    const rescheduleBtn = document.createElement("button");
    rescheduleBtn.type = "button";
    rescheduleBtn.className = "btn-action secondary";
    rescheduleBtn.textContent = "Reschedule";
    rescheduleBtn.onclick = () => {
      selectedAppointmentId = appointment.id;
      rescheduleDialog.showModal();
    };

    const queueLink = document.createElement("a");
    queueLink.className = "btn-action queue";
    queueLink.href = "patientQueue.html";
    queueLink.textContent = "Queue";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-action danger";
    cancelBtn.textContent = "Cancel";
    cancelBtn.onclick = () => {
      selectedAppointmentId = appointment.id;
      cancelDialog.showModal();
    };

    actions.appendChild(queueLink);
    actions.appendChild(rescheduleBtn);
    actions.appendChild(cancelBtn);

    article.appendChild(actions);
  }

  return article;
}

// Splits loaded appointments into upcoming and past/cancelled groups and
// renders both tab panels.
function renderAppointments() {
  upcomingList.innerHTML = "";
  pastList.innerHTML = "";

  const upcomingAppointments = appointments
  .filter(appt => {
    const status = normalizeStatus(appt.status);

    return (
      !["cancelled", "completed", "missed"].includes(status) &&
      !isPast(appt.date)
    );
  })

  const pastAppointments = appointments
  .filter(appt => {
    const status = normalizeStatus(appt.status);

    return (
      isPast(appt.date) ||
      ["cancelled", "completed", "missed"].includes(status)
    );
  })

  upcomingCount.textContent = upcomingAppointments.length;
  pastCount.textContent = pastAppointments.length;

  if (appointments.length === 0) {
    upcomingList.appendChild(
      createEmptyState(
        "No Active Care Plans",
        "Your upcoming health visits will appear here once booked.",
        "Find a Care Center"
      )
    );

    pastList.appendChild(
      createEmptyState(
        "No Past History",
        "Your completed appointments will be archived here.",
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
        "Clear Schedule",
        "You have no upcoming appointments scheduled at this time.",
        "Book a Visit"
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
        "History Empty",
        "We couldn't find any past appointment records.",
        ""
      )
    );
  }
}

// Wires the upcoming/past tab buttons to their matching appointment panels.
function setupTabs() {
  const buttons = document.querySelectorAll(".tab-trigger");
  const panels = document.querySelectorAll(".tab-panel");

  buttons.forEach(button => {
    button.addEventListener("click", () => {
      buttons.forEach(btn => {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
      });
      panels.forEach(panel => {
        panel.classList.remove("active");
        panel.hidden = true;
      });

      button.classList.add("active");
      button.setAttribute("aria-selected", "true");
      
      const targetPanel = document.getElementById(`${button.dataset.tab}-panel`);
      if (targetPanel) {
        targetPanel.classList.add("active");
        targetPanel.hidden = false;
      }
    });
  });
}

document.getElementById("cancel-confirm").addEventListener("click", async () => {
    if (!selectedAppointmentId) return;
    
    try {
      // change to put/post request to update status to cancelled instead of deleting;
       const response = await fetch(`/api/appointments/${selectedAppointmentId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            }
        });

      if (response.ok) {
        const appointment = appointments.find(appt => appt.id === selectedAppointmentId);
        if (appointment) {
            appointment.status = "cancelled";
        }
        showToast("Appointment cancelled successfully.", "success");
        renderAppointments();
      } else {
        const err = await response.json();
        showToast(`Failed to cancel: ${err.error}`, "error");
      }
    } catch (error) {
    console.error("Cancellation error:", error);
    showToast("Error connecting to server for cancellation.", "error");
    }
  })

// document.getElementById("cancel-close").addEventListener("click", () => {
//   cancelDialog.close();
//   selectedAppointmentId = null;
// });

document.getElementById("reschedule-confirm").addEventListener("click", () => {
    const appointment = appointments.find(appt => appt.id === selectedAppointmentId);
    if (appointment) {
        const clinicId = appointment.clinicId;
        const clinicName = encodeURIComponent(appointment.clinicName || "");
   ;     const clinicAddress = encodeURIComponent(appointment.clinicAddress || "");
        const oldId = appointment.id;
        
        window.location.href = `Availability.html?id=${clinicId}&name=${clinicName}&address=${clinicAddress}&oldAppointmentId=${oldId}`;
    }
});

// document.getElementById("reschedule-close").addEventListener("click", () => {
//   rescheduleDialog.close();
//   selectedAppointmentId = null;
// });

// Initializes the appointments page by enabling tabs, loading data, and
// rendering the first view.
async function initAppointmentsPage() {
  setupTabs();
  await fetchAppointments();
  renderAppointments();
}

initAppointmentsPage();
