// staffDashboard.js - Demo Placeholder
const auth = firebase.auth();
const db   = firebase.firestore();

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    const userDoc = await db.collection("users").doc(user.uid).get();
    
    if (!userDoc.exists || userDoc.data().role !== "staff") {
        console.warn("Unauthorized access to staff dashboard");
        window.location.href = "dashboard.html";
        return;
    }

    const data = userDoc.data();
    const firstName = (data.fullName || "there").split(" ")[0];
    document.getElementById("userGreeting").textContent = `Welcome, ${firstName}`;

    if (data.clinicId) {
        const clinicDoc = await db.collection("clinics").doc(data.clinicId).get();
        if (clinicDoc.exists) {
            document.getElementById("clinicNameDisplay").textContent = clinicDoc.data().clinicName;
        }
    }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    auth.signOut().then(() => window.location.href = "login.html");
});
