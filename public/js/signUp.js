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
    const role = document.getElementById("role").value;
    if (role === "admin") return; // let the admin listener handle it
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
        localStorage.setItem("patientId", user.uid);
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Error creating patient:", error);
        alert("Error: " + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalize Account";
    }
});
// ======================= ROLE SELECTION =======================

const roleSelect = document.getElementById("role");
const adminFields = document.getElementById("adminFields");

roleSelect.addEventListener("change", () => {
    const role = roleSelect.value;
    const isAdmin = role === "admin";

    adminFields.hidden = !isAdmin;
    adminFields.setAttribute("aria-hidden", String(!isAdmin));

    if (!isAdmin) document.getElementById("adminCode").value = "";
});
// ======================= ADMIN SUBMISSION =======================
signupForm.addEventListener("submit", async (e) => {
    const role = document.getElementById("role").value;
    if (role !== "admin") return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const user = auth.currentUser;
    if (!user) {
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
        return;
    }

    const submitBtn = signupForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving...";

    const adminCode = document.getElementById("adminCode").value.trim();

    if (!adminCode) {
        alert("Please enter your admin code.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalize Account";
        return;
    }

    const adminData = {
        uid: user.uid,
        fullName: user.displayName || "Unknown User",
        email: user.email,
        phone: document.getElementById("phone").value,
        adminCode
    };

    try {
        const response = await fetch("/api/user/admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(adminData)
        });

        const result = await response.json();

        if (response.status === 403) {
            throw new Error("Invalid admin code. Please check and try again.");
        }

        if (!response.ok) {
            throw new Error(result.message || "Something went wrong");
        }

        console.log("Admin record created successfully!");
        window.location.href = "adminDashboard.html";
    } catch (error) {
        console.error("Error creating admin:", error);
        alert("Error: " + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalize Account";
    }
});