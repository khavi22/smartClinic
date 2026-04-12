console.log("signUp.js loaded");

const firebaseConfig = {
    apiKey: "AIzaSyDWr5lA9QgmKZLl5M8ctDKQWqS7yOFn_LY",
    authDomain: "smartclinic-11971.firebaseapp.com",
    projectId: "smartclinic-11971",
    storageBucket: "smartclinic-11971.firebasestorage.app",
    messagingSenderId: "301262646979",
    appId: "1:301262646979:web:6529009c676257565a7c76"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

// Guard: if no user is logged in, send them back to login
auth.onAuthStateChanged((user) => {
    if (!user) {
        console.warn("No session — redirecting to login");
        window.location.href = "login.html";
    }
});

const signupForm = document.getElementById("signupForm");

signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
        return;
    }

    const submitBtn = signupForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    const patientData = {
        uid: user.uid,
        fullName: user.displayName,
        email: user.email,
        role: document.getElementById("role").value,
        phone: document.getElementById("phone").value,
        idNumber: document.getElementById("idNumber").value || "N/A",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("patients").doc(user.uid).set(patientData);
        console.log("Patient record created successfully!");
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Error creating patient:", error);
        alert("Database Error: " + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalize Account";
    }
});
