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

const auth = firebase.auth();

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
        fullName: user.displayName || "Unknown User",
        email: user.email,
        role: document.getElementById("role").value,
        phone: document.getElementById("phone").value,
        idNumber: document.getElementById("idNumber").value || "N/A"
    };

    try {
        const response = await fetch("/api/user/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(patientData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Something went wrong");
        }

        console.log("Patient record created successfully!");
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Error creating patient:", error);
        alert("Error: " + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalize Account";
    }
});