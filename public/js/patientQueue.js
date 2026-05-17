async function loadNextQueue() {
    const loading = document.getElementById("loading");
    const content = document.getElementById("content");
    const noData = document.getElementById("noData");
    const patientId = localStorage.getItem("patientId");

    try {
        const res = await fetch(`/api/patient/queue/${patientId}`, {
            method: "GET",
            credentials: "include" // if using cookies auth
        });

        const data = await res.json();
        console.log("Fetched queue data:", data);
        loading.style.display = "none";

        if (!data) {
            noData.classList.remove("hidden");
            return;
        }

        const q = data.queue;

        document.getElementById("clinicName").innerText = q.clinicName;

        document.getElementById("wait").innerText =q.estimatedWaitTime + " mins";

        document.getElementById("date").innerText = q.appointmentTime;

        const date = new Date(q.appointmentDate);
        document.getElementById("date").innerText = date.toLocaleString();

        content.classList.remove("hidden");

    } catch (error) {
        console.error("Error loading queue:", error);
        loading.innerText = "Failed to load appointment.";
    }
}

loadNextQueue();