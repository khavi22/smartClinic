const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const errorState = document.getElementById("errorState");
const queueContent = document.getElementById("queueContent");
const errorMessage = document.getElementById("errorMessage");
const refreshQueue = document.getElementById("refreshQueue");
const retryQueue = document.getElementById("retryQueue");

const fields = {
  patientName: document.getElementById("patientName"),
  clinicName: document.getElementById("clinicName"),
  clinicAddress: document.getElementById("clinicAddress"),
  estimatedWait: document.getElementById("estimatedWait"),
  waitBreakdown: document.getElementById("waitBreakdown"),
  positionLabel: document.getElementById("positionLabel"),
  progressFill: document.getElementById("progressFill"),
  appointmentTime: document.getElementById("appointmentTime"),
  patientsAhead: document.getElementById("patientsAhead"),
  totalInQueue: document.getElementById("totalInQueue"),
  waitBeforeYou: document.getElementById("waitBeforeYou"),
  updatedAt: document.getElementById("updatedAt"),
  snapshotPatientName: document.getElementById("snapshotPatientName"),
  snapshotClinicName: document.getElementById("snapshotClinicName"),
  snapshotClinicAddress: document.getElementById("snapshotClinicAddress"),
  snapshotAppointmentTime: document.getElementById("snapshotAppointmentTime"),
  snapshotPosition: document.getElementById("snapshotPosition"),
  snapshotTotal: document.getElementById("snapshotTotal"),
  snapshotWaitBefore: document.getElementById("snapshotWaitBefore"),
  snapshotEstimatedWait: document.getElementById("snapshotEstimatedWait")
};

function showOnly(section) {
  [loadingState, emptyState, errorState, queueContent].forEach(element => {
    if (!element) return;
    element.classList.toggle("hidden", element !== section);
  });
}

function setText(element, value, fallback = "--") {
  if (!element) return;
  const empty = value === undefined || value === null || value === "";
  element.textContent = empty ? fallback : String(value);
}

function formatMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return "--";
  if (minutes <= 0) return "0 min";

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours && remaining) return `${hours} hr ${remaining} min`;
  if (hours) return `${hours} hr`;
  return `${remaining} min`;
}

function formatCount(value, singular, plural = `${singular}s`) {
  const count = Number(value);
  if (!Number.isFinite(count)) return "--";
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderQueue(queue) {
  const position = Number(queue.position) || 0;
  const totalInQueue = Number(queue.totalInQueue) || 0;
  const patientsAhead = Math.max(position - 1, 0);
  const progress = totalInQueue > 0
    ? Math.max(8, Math.min(100, ((totalInQueue - position + 1) / totalInQueue) * 100))
    : 0;

  setText(fields.patientName, queue.patientName, "Patient");
  setText(fields.clinicName, queue.clinicName, "Clinic pending");
  setText(fields.clinicAddress, queue.clinicAddress, "Clinic address pending");
  setText(fields.estimatedWait, formatMinutes(queue.estimatedWaitTime));
  setText(fields.waitBreakdown, `${formatMinutes(queue.waitBeforeYou)} from active patients before you`);
  setText(fields.positionLabel, position && totalInQueue ? `${position} of ${totalInQueue}` : "--");
  setText(fields.appointmentTime, queue.appointmentTime);
  setText(fields.patientsAhead, patientsAhead);
  setText(fields.totalInQueue, totalInQueue);
  setText(fields.waitBeforeYou, formatMinutes(queue.waitBeforeYou));
  setText(fields.updatedAt, `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);

  if (fields.progressFill) {
    fields.progressFill.style.width = `${progress}%`;
  }

  setText(fields.snapshotPatientName, queue.patientName);
  setText(fields.snapshotClinicName, queue.clinicName);
  setText(fields.snapshotClinicAddress, queue.clinicAddress);
  setText(fields.snapshotAppointmentTime, queue.appointmentTime);
  setText(fields.snapshotPosition, position && totalInQueue ? `${position} of ${totalInQueue}` : "--");
  setText(fields.snapshotTotal, formatCount(totalInQueue, "active patient"));
  setText(fields.snapshotWaitBefore, formatMinutes(queue.waitBeforeYou));
  setText(fields.snapshotEstimatedWait, formatMinutes(queue.estimatedWaitTime));

  showOnly(queueContent);
}

async function loadNextQueue() {
  const patientId = localStorage.getItem("patientId");

  if (!patientId) {
    window.location.href = "login.html";
    return;
  }

  showOnly(loadingState);

  try {
    const response = await fetch(`/api/patient/queue/${encodeURIComponent(patientId)}`, {
      method: "GET",
      credentials: "include"
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
      throw new Error(data.message || `Queue request failed with ${response.status}`);
    }

    if (!data.queue) {
      showOnly(emptyState);
      return;
    }

    renderQueue(data.queue);
  } catch (error) {
    console.error("Error loading queue:", error);
    setText(errorMessage, error.message || "We could not load your queue right now.");
    showOnly(errorState);
  }
}

if (refreshQueue) {
  refreshQueue.addEventListener("click", loadNextQueue);
}

if (retryQueue) {
  retryQueue.addEventListener("click", loadNextQueue);
}

loadNextQueue();
