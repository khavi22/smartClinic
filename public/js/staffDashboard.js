const auth = firebase.auth();

const queueTableBody = document.getElementById("queueTableBody");
const totalQueueCount = document.getElementById("totalQueueCount");
const waitingQueueCount = document.getElementById("waitingQueueCount");
const consultationQueueCount = document.getElementById("consultationQueueCount");
const addQueueForm = document.getElementById("addQueueForm");
const patientNameInput = document.getElementById("patientNameInput");
const appointmentTimeInput = document.getElementById("appointmentTimeInput");
const priorityInput = document.getElementById("priorityInput");
const queueActionStatus = document.getElementById("queueActionStatus");

const QUEUE_STATUSES = ["WAITING", "IN_CONSULTATION", "COMPLETE", "MISSED"];
let currentClinicId = null;
let currentIdToken = null;
let currentStaffId = null;

function setQueueMessage(message) {
    if (!queueTableBody) return;

    queueTableBody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "table-empty";
    cell.textContent = message;
    row.appendChild(cell);
    queueTableBody.appendChild(row);
}

function setActionStatus(message, isError = false) {
    if (!queueActionStatus) return;
    queueActionStatus.textContent = message;
    queueActionStatus.classList.toggle("error", isError);
}

function normalizeQueue(queue) {
    if (Array.isArray(queue)) {
        return queue;
    }

    if (!queue || typeof queue !== "object") {
        return [];
    }

    return QUEUE_STATUSES.flatMap((status) => {
        const patients = Array.isArray(queue[status]) ? queue[status] : [];
        return patients.map((patient) => ({
            ...patient,
            status: patient.status || status
        }));
    });
}

function getPatientName(patient) {
    return patient.patientName ||
        patient.fullName ||
        patient.name ||
        patient.patientFullName ||
        patient.patientId ||
        "Unknown patient";
}

function getAppointmentTime(patient) {
    return patient.appointmentTime ||
        patient.timeSlot ||
        patient.time ||
        patient.appointmentSlot ||
        "--";
}

function getQueueNumber(patient, index) {
    return patient.queueNumber ||
        patient.number ||
        patient.ticketNumber ||
        index + 1;
}

function getTodayKey() {
    return new Date().toISOString().split("T")[0];
}

function formatStatus(status) {
    return String(status || "WAITING").replace(/_/g, " ").toLowerCase();
}

function formatPriority(priority) {
    if (Number(priority) < 0) return "Urgent";
    if (Number(priority) > 0) return "Low";
    return "Normal";
}

function isLockedStatus(status) {
    return ["COMPLETE", "MISSED"].includes(status || "");
}

function renderQueue(queue) {
    const patients = normalizeQueue(queue);
    const waiting = patients.filter((patient) => patient.status === "WAITING").length;
    const inConsultation = patients.filter((patient) => patient.status === "IN_CONSULTATION").length;

    if (totalQueueCount) totalQueueCount.textContent = String(patients.length);
    if (waitingQueueCount) waitingQueueCount.textContent = String(waiting);
    if (consultationQueueCount) consultationQueueCount.textContent = String(inConsultation);

    if (!queueTableBody) return;
    queueTableBody.innerHTML = "";

    if (patients.length === 0) {
        setQueueMessage("No patients are currently in the queue.");
        return;
    }

    patients.forEach((patient, index) => {
        const patientStatus = patient.status || "WAITING";
        const statusLocked = isLockedStatus(patientStatus);
        const row = document.createElement("tr");
        const values = [
            getQueueNumber(patient, index),
            getPatientName(patient),
            getAppointmentTime(patient),
            formatPriority(patient.priority)
        ];

        values.forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            row.appendChild(cell);
        });

        const statusCell = document.createElement("td");
        const statusTag = document.createElement("span");
        statusTag.className = "status-tag";
        statusTag.textContent = formatStatus(patient.status);
        statusCell.appendChild(statusTag);
        row.appendChild(statusCell);

        const actionsCell = document.createElement("td");
        actionsCell.className = "queue-actions";

        const startButton = document.createElement("button");
        startButton.type = "button";
        startButton.className = "queue-action-btn start";
        startButton.textContent = "Start";
        startButton.disabled = patientStatus !== "WAITING";
        startButton.addEventListener("click", () => startPatientConsultation(patient));

        const statusSelect = document.createElement("select");
        statusSelect.className = "queue-status-select";
        statusSelect.setAttribute("aria-label", `Update ${getPatientName(patient)} status`);
        statusSelect.disabled = statusLocked;

        QUEUE_STATUSES.forEach((status) => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = formatStatus(status);
            option.selected = patientStatus === status;
            statusSelect.appendChild(option);
        });

        const updateButton = document.createElement("button");
        updateButton.type = "button";
        updateButton.className = "queue-action-btn";
        updateButton.textContent = "Update";
        updateButton.disabled = statusLocked;
        updateButton.addEventListener("click", () => updatePatientStatus(patient, statusSelect.value));

        const rescheduleButton = document.createElement("button");
        rescheduleButton.type = "button";
        rescheduleButton.className = "queue-action-btn";
        rescheduleButton.textContent = "Reschedule";
        rescheduleButton.disabled = patientStatus !== "WAITING";
        rescheduleButton.addEventListener("click", () => showReschedulePicker(patient, actionsCell));

        actionsCell.append(startButton, rescheduleButton, statusSelect, updateButton);
        row.appendChild(actionsCell);

        queueTableBody.appendChild(row);
    });
}

async function loadQueue(clinicId, idToken) {
    if (!clinicId) {
        setQueueMessage("No clinic is linked to this staff profile.");
        return;
    }

    setQueueMessage("Loading queue...");

    const response = await fetch(`/api/queue/${encodeURIComponent(clinicId)}`, {
        headers: {
            "Authorization": `Bearer ${idToken}`
        }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
        throw new Error(result.message || `Queue request failed with ${response.status}`);
    }

    renderQueue(result.queue);
}

async function refreshQueue() {
    if (!currentClinicId || !currentIdToken) return;
    await loadQueue(currentClinicId, currentIdToken);
}

async function addPatientToQueue(event) {
    event.preventDefault();

    if (!currentClinicId || !currentIdToken) {
        setActionStatus("No clinic is linked to this staff profile.", true);
        return;
    }

    const patientName = patientNameInput.value.trim();
    if (!patientName) {
        setActionStatus("Enter a patient name before adding to the queue.", true);
        return;
    }

    const submitButton = addQueueForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setActionStatus("Adding patient...");

    try {
        const appointmentTime = appointmentTimeInput.value || "--";
        const priority = Number(priorityInput.value || 0);

        const response = await fetch(`/api/queue/${encodeURIComponent(currentClinicId)}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${currentIdToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                patientName,
                appointmentTime,
                timeSlot: appointmentTime,
                priority,
                status: "WAITING",
                date: getTodayKey(),
                addedBy: currentStaffId
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
            throw new Error(result.message || `Add patient failed with ${response.status}`);
        }

        const assignedTime = result.queueItem?.timeSlot || result.queueItem?.appointmentTime;
        addQueueForm.reset();
        setActionStatus(`${patientName} was added to the queue${assignedTime ? ` for ${assignedTime}` : ""}.`);
        await refreshQueue();
    } catch (error) {
        console.error("Error adding patient to queue:", error);
        setActionStatus(error.message || "Failed to add patient.", true);
    } finally {
        submitButton.disabled = false;
    }
}

async function fetchAvailableSlots(patient) {
    const params = new URLSearchParams({
        date: patient.date || getTodayKey(),
        queueItemId: patient.queueItemId
    });

    const response = await fetch(`/api/queue/${encodeURIComponent(currentClinicId)}/available-slots?${params.toString()}`, {
        headers: {
            "Authorization": `Bearer ${currentIdToken}`
        }
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
        throw new Error(result.message || `Available slots request failed with ${response.status}`);
    }

    return Array.isArray(result.slots) ? result.slots : [];
}

async function showReschedulePicker(patient, actionsCell) {
    if (!currentClinicId || !currentIdToken || !patient.queueItemId) {
        setActionStatus("This queue item cannot be rescheduled.", true);
        return;
    }

    if ((patient.status || "WAITING") !== "WAITING") {
        setActionStatus("Only waiting patients can be rescheduled.", true);
        return;
    }

    try {
        setActionStatus(`Loading slots for ${getPatientName(patient)}...`);
        const slots = await fetchAvailableSlots(patient);

        if (slots.length === 0) {
            setActionStatus("No available slots left for this day.", true);
            return;
        }

        const picker = document.createElement("span");
        picker.className = "reschedule-picker";

        const slotSelect = document.createElement("select");
        slotSelect.className = "queue-status-select";
        slotSelect.setAttribute("aria-label", `Choose new slot for ${getPatientName(patient)}`);

        slots.forEach((slot) => {
            const option = document.createElement("option");
            option.value = slot.time;
            option.textContent = `${slot.time} (${Math.max(0, slot.total - slot.taken)} open)`;
            option.selected = slot.time === (patient.timeSlot || patient.appointmentTime);
            slotSelect.appendChild(option);
        });

        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.className = "queue-action-btn start";
        saveButton.textContent = "Save";
        saveButton.addEventListener("click", () => reschedulePatient(patient, slotSelect.value));

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.className = "queue-action-btn";
        cancelButton.textContent = "Cancel";
        cancelButton.addEventListener("click", () => refreshQueue());

        picker.append(slotSelect, saveButton, cancelButton);
        actionsCell.replaceChildren(picker);
        setActionStatus(`Choose a new slot for ${getPatientName(patient)}.`);
    } catch (error) {
        console.error("Error loading reschedule slots:", error);
        setActionStatus(error.message || "Failed to load available slots.", true);
    }
}

async function reschedulePatient(patient, timeSlot) {
    if (!currentClinicId || !currentIdToken || !patient.queueItemId) {
        setActionStatus("This queue item cannot be rescheduled.", true);
        return;
    }

    try {
        setActionStatus(`Rescheduling ${getPatientName(patient)}...`);
        const response = await fetch(`/api/queue/${encodeURIComponent(currentClinicId)}/${encodeURIComponent(patient.queueItemId)}/reschedule`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${currentIdToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                timeSlot,
                staffId: currentStaffId
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
            throw new Error(result.message || `Reschedule failed with ${response.status}`);
        }

        const assignedTime = result.queueItem?.timeSlot || timeSlot;
        setActionStatus(`${getPatientName(patient)} was rescheduled for ${assignedTime}.`);
        await refreshQueue();
    } catch (error) {
        console.error("Error rescheduling patient:", error);
        setActionStatus(error.message || "Failed to reschedule patient.", true);
    }
}

async function startPatientConsultation(patient) {
    if (!currentClinicId || !currentIdToken || !patient.queueItemId) {
        setActionStatus("This queue item cannot be started.", true);
        return;
    }

    try {
        setActionStatus(`Starting consultation for ${getPatientName(patient)}...`);
        const response = await fetch(`/api/queue/${encodeURIComponent(currentClinicId)}/start-consultation`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${currentIdToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                queueItemId: patient.queueItemId,
                staffId: currentStaffId
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
            throw new Error(result.message || `Start consultation failed with ${response.status}`);
        }

        setActionStatus(`${getPatientName(patient)} is now in consultation.`);
        await refreshQueue();
    } catch (error) {
        console.error("Error starting consultation:", error);
        setActionStatus(error.message || "Failed to start consultation.", true);
    }
}

async function updatePatientStatus(patient, status) {
    if (!currentClinicId || !currentIdToken || !patient.queueItemId) {
        setActionStatus("This queue item cannot be updated.", true);
        return;
    }

    if (isLockedStatus(patient.status)) {
        setActionStatus("Missed and complete patients cannot be changed.", true);
        return;
    }

    try {
        setActionStatus(`Updating ${getPatientName(patient)}...`);
        const response = await fetch(`/api/queue/${encodeURIComponent(currentClinicId)}/${encodeURIComponent(patient.queueItemId)}`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${currentIdToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status,
                updatedBy: currentStaffId
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
            throw new Error(result.message || `Update status failed with ${response.status}`);
        }

        setActionStatus(`${getPatientName(patient)} is now ${formatStatus(status)}.`);
        await refreshQueue();
    } catch (error) {
        console.error("Error updating patient status:", error);
        setActionStatus(error.message || "Failed to update status.", true);
    }
}

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        console.log("Staff Dashboard: Fetching profile from server...");
        const idToken = await user.getIdToken();
        currentIdToken = idToken;
        currentStaffId = user.uid;
        const response = await fetch(`/api/user/login/${user.uid}?email=${encodeURIComponent(user.email || "")}`, {
            headers: { "Authorization": `Bearer ${idToken}` }
        });

        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const result = await response.json();

        if (!result.exists || !result.profile || result.profile.role !== "staff") {
            console.warn("Unauthorized or missing staff profile");
            window.location.href = "dashboard.html";
            return;
        }

        const data = result.profile;
        currentClinicId = data.clinicId;
        const firstName = (data.fullName || "there").split(" ")[0];
        document.getElementById("userGreeting").textContent = `Welcome, ${firstName}`;

        const clinicNameDisplay = document.getElementById("clinicNameDisplay");
        if (clinicNameDisplay) {
            clinicNameDisplay.textContent = data.clinicName || "Clinic Access";
        }

        await loadQueue(currentClinicId, idToken);

    } catch (error) {
        console.error("Staff Dashboard: Error loading data:", error);
        setQueueMessage(error.message || "Failed to load queue.");
    }
});

if (addQueueForm) {
    addQueueForm.addEventListener("submit", addPatientToQueue);
}

document.getElementById("logoutBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    auth.signOut().then(() => window.location.href = "login.html");
});
