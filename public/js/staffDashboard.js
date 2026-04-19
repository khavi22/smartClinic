// staffDashboard.js - Demo Placeholder
const auth = firebase.auth();
const db   = firebase.firestore();

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

    } catch (error) {
        console.error("Staff Dashboard: Error loading profile:", error);
        window.location.href = "dashboard.html";
    }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    auth.signOut().then(() => window.location.href = "login.html");
});
