const auth = firebase.auth();

const queueTableBody = document.getElementById("queueTableBody");
const totalQueueCount = document.getElementById("totalQueueCount");
const waitingQueueCount = document.getElementById("waitingQueueCount");
const consultationQueueCount = document.getElementById("consultationQueueCount");

const QUEUE_STATUSES = ["WAITING", "IN_CONSULTATION", "COMPLETE", "MISSED"];

function setQueueMessage(message) {
    if (!queueTableBody) return;

    queueTableBody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
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
        const row = document.createElement("tr");
        const values = [
            getQueueNumber(patient, index),
            getPatientName(patient),
            getAppointmentTime(patient),
            patient.priority ?? "Normal"
        ];

        values.forEach((value) => {
            const cell = document.createElement("td");
            cell.textContent = String(value);
            row.appendChild(cell);
        });

        const statusCell = document.createElement("td");
        const statusTag = document.createElement("span");
        statusTag.className = "status-tag";
        statusTag.textContent = String(patient.status || "WAITING").replace(/_/g, " ").toLowerCase();
        statusCell.appendChild(statusTag);
        row.appendChild(statusCell);

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

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        console.log("Staff Dashboard: Fetching profile from server...");
        const idToken = await user.getIdToken();
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
        const firstName = (data.fullName || "there").split(" ")[0];
        document.getElementById("userGreeting").textContent = `Welcome, ${firstName}`;

        const clinicNameDisplay = document.getElementById("clinicNameDisplay");
        if (clinicNameDisplay) {
            clinicNameDisplay.textContent = data.clinicName || "Clinic Access";
        }

        await loadQueue(data.clinicId, idToken);

    } catch (error) {
        console.error("Staff Dashboard: Error loading data:", error);
        setQueueMessage(error.message || "Failed to load queue.");
    }
});

document.getElementById("logoutBtn").addEventListener("click", (event) => {
    event.preventDefault();
    auth.signOut().then(() => window.location.href = "login.html");
});
