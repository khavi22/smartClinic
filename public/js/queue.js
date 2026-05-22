const auth = firebase.auth();

const queueTableBody = document.getElementById("queueTableBody");
const totalQueueCount = document.getElementById("totalQueueCount");
const waitingQueueCount = document.getElementById("waitingQueueCount");
const consultationQueueCount = document.getElementById("consultationQueueCount");
const addQueueForm = document.getElementById("addQueueForm");
const patientLookupModeInput = document.getElementById("patientLookupModeInput");
const patientNameInput = document.getElementById("patientNameInput");
const patientEmailInput = document.getElementById("patientEmailInput");
const patientEmailField = document.getElementById("patientEmailField");
const addQueueSubmitText = document.getElementById("addQueueSubmitText");
const appointmentTimeInput = document.getElementById("appointmentTimeInput");
const priorityInput = document.getElementById("priorityInput");
const queueActionStatus = document.getElementById("queueActionStatus");

const QUEUE_STATUSES = ["WAITING", "IN_CONSULTATION", "COMPLETE", "MISSED"];
const STATUS_UPDATE_OPTIONS = ["WAITING", "COMPLETE", "MISSED"];
let currentClinicId = null;
let currentIdToken = null;
let currentStaffId = null;
let currentClinicName = "";

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
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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

function isEmailMode() {
    return patientLookupModeInput?.value === "email";
}

function updatePatientLookupMode() {
    const emailMode = isEmailMode();
    const patientNameField = patientNameInput?.closest(".field-group");

    if (patientNameField) {
        patientNameField.hidden = emailMode;
    }

    if (patientEmailField) {
        patientEmailField.hidden = !emailMode;
    }

    if (patientNameInput) {
        patientNameInput.required = !emailMode;
    }

    if (patientEmailInput) {
        patientEmailInput.required = emailMode;
    }

    if (addQueueSubmitText) {
        addQueueSubmitText.textContent = emailMode ? "Book Appointment" : "Add to Queue";
    }
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
        
        const priorityVal = formatPriority(patient.priority);
        const priorityClass = priorityVal.toLowerCase();

        row.innerHTML = `
            <td class="col-num">${getQueueNumber(patient, index)}</td>
            <td class="col-name"><strong>${getPatientName(patient)}</strong></td>
            <td class="col-time">${getAppointmentTime(patient)}</td>
            <td class="col-priority"><span class="priority-badge ${priorityClass}">${priorityVal}</span></td>
            <td class="col-status"><span class="status-tag ${patientStatus.toLowerCase()}">${formatStatus(patient.status)}</span></td>
            <td class="col-actions text-right"></td>
        `;

        const actionsCell = row.querySelector(".col-actions");

        const actionsWrap = document.createElement("div");
        actionsWrap.className = "queue-row-actions";

        const primaryActions = document.createElement("div");
        primaryActions.className = "queue-primary-actions";

        const statusActions = document.createElement("div");
        statusActions.className = "queue-status-actions";

        const startButton = document.createElement("button");
        startButton.type = "button";
        startButton.className = "queue-row-btn start";
        startButton.title = "Start Consultation";
        startButton.setAttribute("aria-label", `Start consultation for ${getPatientName(patient)}`);
        startButton.innerHTML = "<i class='bx bx-play'></i><span>Start</span>";
        startButton.disabled = patientStatus !== "WAITING";
        startButton.addEventListener("click", () => startPatientConsultation(patient));

        const statusSelect = document.createElement("select");
        statusSelect.className = "mini-status-select";
        statusSelect.setAttribute("aria-label", `Choose status for ${getPatientName(patient)}`);
        statusSelect.disabled = statusLocked;

        const updateOptions = patientStatus === "IN_CONSULTATION"
            ? ["COMPLETE", "MISSED"]
            : STATUS_UPDATE_OPTIONS;

        if (!updateOptions.includes(patientStatus)) {
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = "Update to...";
            placeholder.selected = true;
            placeholder.disabled = true;
            statusSelect.appendChild(placeholder);
        }

        updateOptions.forEach((status) => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = formatStatus(status);
            option.selected = patientStatus === status;
            statusSelect.appendChild(option);
        });

        const updateButton = document.createElement("button");
        updateButton.type = "button";
        updateButton.className = "queue-row-btn compact update";
        updateButton.title = "Update Status";
        updateButton.setAttribute("aria-label", `Update status for ${getPatientName(patient)}`);
        updateButton.innerHTML = "<i class='bx bx-check'></i><span>Update</span>";
        updateButton.addEventListener("click", () => updatePatientStatus(patient, statusSelect.value));

        const syncUpdateButtonState = () => {
            updateButton.disabled = statusLocked || !statusSelect.value || statusSelect.value === patientStatus;
        };

        statusSelect.addEventListener("change", syncUpdateButtonState);
        syncUpdateButtonState();

        const rescheduleButton = document.createElement("button");
        rescheduleButton.type = "button";
        rescheduleButton.className = "queue-row-btn reschedule";
        rescheduleButton.title = "Reschedule Slot";
        rescheduleButton.setAttribute("aria-label", `Reschedule ${getPatientName(patient)}`);
        rescheduleButton.innerHTML = "<i class='bx bx-calendar-edit'></i><span>Reschedule</span>";
        rescheduleButton.disabled = patientStatus !== "WAITING";
        rescheduleButton.addEventListener("click", () => showReschedulePicker(patient, actionsCell));

        primaryActions.append(startButton, rescheduleButton);
        statusActions.append(statusSelect, updateButton);
        actionsWrap.append(primaryActions, statusActions);
        actionsCell.appendChild(actionsWrap);
        queueTableBody.appendChild(row);
    });
}

async function fetchAndRenderWaitTime(clinicId, idToken) {
    const predictedWaitTimeEl = document.getElementById("predictedWaitTime");
    const predictedWaitRangeEl = document.getElementById("predictedWaitRange");

    if (!predictedWaitTimeEl || !predictedWaitRangeEl) return;

    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await fetch(`/api/queue/${encodeURIComponent(clinicId)}/predict-waittime?date=${todayStr}`, {
            headers: {
                "Authorization": `Bearer ${idToken}`
            }
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                predictedWaitTimeEl.textContent = `${data.estimatedWaitTime} mins`;
                predictedWaitRangeEl.textContent = `Range: ${data.waitTimeRange}`;
                return;
            }
        }
    } catch (err) {
        console.warn("Failed to fetch predicted wait time:", err);
    }
    
    predictedWaitTimeEl.textContent = "-- mins";
    predictedWaitRangeEl.textContent = "Unavailable";
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
    await fetchAndRenderWaitTime(clinicId, idToken);
}

async function refreshQueue() {
    if (!currentClinicId || !currentIdToken) return;
    await loadQueue(currentClinicId, currentIdToken);
}

function renderAddQueueSlotOptions(slots, selectedSlot = "") {
    if (!appointmentTimeInput) return;

    appointmentTimeInput.innerHTML = "";

    if (slots.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No slots available";
        appointmentTimeInput.appendChild(option);
        appointmentTimeInput.disabled = true;
        return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a time slot";
    appointmentTimeInput.appendChild(placeholder);

    slots.forEach((slot) => {
        const openCount = Math.max(0, Number(slot.total || 0) - Number(slot.taken || 0));
        const option = document.createElement("option");
        option.value = slot.time;
        option.textContent = `${slot.time} (${openCount} open)`;
        option.selected = slot.time === selectedSlot;
        appointmentTimeInput.appendChild(option);
    });

    appointmentTimeInput.disabled = false;
}

async function loadAddQueueSlots(selectedSlot = "", showError = true) {
    if (!currentClinicId || !currentIdToken || !appointmentTimeInput) return;

    appointmentTimeInput.disabled = true;
    appointmentTimeInput.innerHTML = '<option value="">Loading slots...</option>';

    try {
        const slots = await fetchAvailableSlots({ date: getTodayKey() });
        renderAddQueueSlotOptions(slots, selectedSlot);
    } catch (error) {
        console.error("Error loading add queue slots:", error);
        appointmentTimeInput.innerHTML = '<option value="">Slots unavailable</option>';
        appointmentTimeInput.disabled = true;

        if (showError) {
            showToast(error.message || "Failed to load available slots.", "error");
        }
    }
}

async function loadClinicServices(clinicId, idToken) {
    const serviceSelect = document.getElementById("serviceSelectInput");
    if (!serviceSelect) return;
    
    serviceSelect.disabled = true;
    serviceSelect.innerHTML = '<option value="">Loading services...</option>';
    
    try {
        const res = await fetch(`/api/clinics/services?clinicId=${encodeURIComponent(clinicId)}`, {
            headers: { "Authorization": `Bearer ${idToken}` }
        });
        if (!res.ok) throw new Error("Failed to fetch services");
        const services = await res.json();
        
        serviceSelect.innerHTML = '<option value="">Select a service type</option>';
        if (services.length === 0) {
            serviceSelect.innerHTML = '<option value="">No services defined</option>';
            return;
        }
        
        services.forEach(service => {
            const option = document.createElement("option");
            option.value = service.id;
            option.dataset.name = service.name;
            option.dataset.duration = service.duration;
            option.textContent = `${service.name} (${service.duration} min)`;
            serviceSelect.appendChild(option);
        });
        
        serviceSelect.disabled = false;
    } catch (error) {
        console.error("Error loading services for manual check-in:", error);
        serviceSelect.innerHTML = '<option value="">Services unavailable</option>';
        serviceSelect.disabled = true;
    }
}

function getSelectedServiceDetails() {
    const serviceSelect = document.getElementById("serviceSelectInput");
    const serviceId = serviceSelect?.value;

    if (!serviceSelect || !serviceId) {
        return null;
    }

    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];

    return {
        serviceId,
        serviceName: selectedOption.dataset.name || selectedOption.textContent,
        serviceDuration: parseInt(selectedOption.dataset.duration, 10)
    };
}

async function createAppointmentByEmail(patientEmail, appointmentTime, serviceDetails) {
    const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${currentIdToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            patientEmail,
            clinicId: currentClinicId,
            clinicName: currentClinicName,
            date: getTodayKey(),
            timeSlot: appointmentTime,
            serviceId: serviceDetails.serviceId,
            serviceName: serviceDetails.serviceName,
            serviceDuration: serviceDetails.serviceDuration
        })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
        throw new Error(result.message || result.error || `Appointment creation failed with ${response.status}`);
    }

    return result.appointment;
}

async function addPatientToQueue(event) {
    event.preventDefault();

    if (!currentClinicId || !currentIdToken) {
        showToast("No clinic is linked to this staff profile.", "error");
        return;
    }

    const emailMode = isEmailMode();
    const patientName = patientNameInput.value.trim();
    const patientEmail = patientEmailInput?.value.trim() || "";

    if (!emailMode && !patientName) {
        showToast("Enter a patient name before adding to the queue.", "error");
        return;
    }

    if (emailMode && !patientEmail) {
        showToast("Enter the patient's account email before booking.", "error");
        return;
    }

    const appointmentTime = appointmentTimeInput.value;
    if (!appointmentTime) {
        showToast("Choose an available one-hour time slot.", "error");
        return;
    }

    const serviceDetails = getSelectedServiceDetails();
    if (!serviceDetails?.serviceId) {
        showToast("Choose a service type.", "error");
        return;
    }

    const submitButton = addQueueForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    showToast(emailMode ? "Creating appointment..." : "Adding patient...", "info");

    try {
        if (emailMode) {
            const appointment = await createAppointmentByEmail(patientEmail, appointmentTime, serviceDetails);
            const bookedTime = appointment?.timeSlot || appointmentTime;

            addQueueForm.reset();
            updatePatientLookupMode();
            showToast(`Appointment created for ${patientEmail} at ${bookedTime}.`, "success");
            await refreshQueue();
            await loadClinicServices(currentClinicId, currentIdToken);
            await loadAddQueueSlots("", false);
            return;
        }

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
                addedBy: currentStaffId,
                serviceId: serviceDetails.serviceId,
                serviceName: serviceDetails.serviceName,
                serviceDuration: serviceDetails.serviceDuration
            })
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || result.success === false) {
            throw new Error(result.message || `Add patient failed with ${response.status}`);
        }

        const assignedTime = result.queueItem?.timeSlot || result.queueItem?.appointmentTime;
        addQueueForm.reset();
        updatePatientLookupMode();
        showToast(`${patientName} was added to the queue${assignedTime ? ` for ${assignedTime}` : ""}.`, "success");
        await refreshQueue();
        await loadClinicServices(currentClinicId, currentIdToken);
        await loadAddQueueSlots("", false);
    } catch (error) {
        console.error("Error adding patient to queue:", error);
        showToast(error.message || "Failed to add patient.", "error");
    } finally {
        submitButton.disabled = false;
    }
}

async function fetchAvailableSlots(patient) {
    const params = new URLSearchParams({
        date: patient.date || getTodayKey()
    });

    if (patient.queueItemId) {
        params.set("queueItemId", patient.queueItemId);
    }

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
        showToast("This queue item cannot be rescheduled.", "error");
        return;
    }

    if ((patient.status || "WAITING") !== "WAITING") {
        showToast("Only waiting patients can be rescheduled.", "error");
        return;
    }

    try {
        showToast(`Loading slots for ${getPatientName(patient)}...`, "info");
        const slots = await fetchAvailableSlots(patient);

        if (slots.length === 0) {
            showToast("No available slots left for this day.", "error");
            return;
        }

        const picker = document.createElement("fieldset");
        picker.className = "reschedule-picker";
        const pickerLegend = document.createElement("legend");
        pickerLegend.className = "visually-hidden";
        pickerLegend.textContent = `Reschedule ${getPatientName(patient)}`;

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

        picker.append(pickerLegend, slotSelect, saveButton, cancelButton);
        actionsCell.replaceChildren(picker);
        showToast(`Choose a new slot for ${getPatientName(patient)}.`, "info");
    } catch (error) {
        console.error("Error loading reschedule slots:", error);
        showToast(error.message || "Failed to load available slots.", "error");
    }
}

async function reschedulePatient(patient, timeSlot) {
    if (!currentClinicId || !currentIdToken || !patient.queueItemId) {
        showToast("This queue item cannot be rescheduled.", "error");
        return;
    }

    try {
        showToast(`Rescheduling ${getPatientName(patient)}...`, "info");
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
        showToast(`${getPatientName(patient)} was rescheduled for ${assignedTime}.`, "success");
        await refreshQueue();
    } catch (error) {
        console.error("Error rescheduling patient:", error);
        showToast(error.message || "Failed to reschedule patient.", "error");
    }
}

async function startPatientConsultation(patient) {
    if (!currentClinicId || !currentIdToken || !patient.queueItemId) {
        showToast("This queue item cannot be started.", "error");
        return;
    }

    try {
        showToast(`Starting consultation for ${getPatientName(patient)}...`, "info");
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

        showToast(`${getPatientName(patient)} is now in consultation.`, "success");
        await refreshQueue();
    } catch (error) {
        console.error("Error starting consultation:", error);
        showToast(error.message || "Failed to start consultation.", "error");
    }
}

async function updatePatientStatus(patient, status) {
    if (!currentClinicId || !currentIdToken || !patient.queueItemId) {
        showToast("This queue item cannot be updated.", "error");
        return;
    }

    if (isLockedStatus(patient.status)) {
        showToast("Missed and complete patients cannot be changed.", "error");
        return;
    }

    try {
        showToast(`Updating ${getPatientName(patient)} to ${status}......`, "info");
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

        showToast(`${getPatientName(patient)} is now ${formatStatus(status)}.`, "info");
        await refreshQueue();
    } catch (error) {
        console.error("Error updating patient status:", error);
        showToast(error.message || "Failed to update status.", "error");
    }
}

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "index.html";
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
        currentClinicName = data.clinicName || "";
        const firstName = (data.fullName || "there").split(" ")[0];
        document.getElementById("userGreeting").textContent = `Welcome, ${firstName}`;

        const clinicNameDisplay = document.getElementById("clinicNameDisplay");
        if (clinicNameDisplay) {
            clinicNameDisplay.textContent = data.clinicName || "Clinic Access";
        }

        await loadQueue(currentClinicId, idToken);
        await loadClinicServices(currentClinicId, idToken);
        await loadAddQueueSlots();

    } catch (error) {
        console.error("Staff Dashboard: Error loading data:", error);
        setQueueMessage(error.message || "Failed to load queue.");
        if (appointmentTimeInput) {
            appointmentTimeInput.innerHTML = '<option value="">Slots unavailable</option>';
            appointmentTimeInput.disabled = true;
        }
    }
});

if (addQueueForm) {
    addQueueForm.addEventListener("submit", addPatientToQueue);
}

if (patientLookupModeInput) {
    patientLookupModeInput.addEventListener("change", updatePatientLookupMode);
    updatePatientLookupMode();
}

document.getElementById("logoutBtn")?.addEventListener("click", (event) => {
    event.preventDefault();
    auth.signOut().then(() => window.location.href = "index.html");
});
