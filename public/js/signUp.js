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
const signupForm = document.getElementById("signupForm");
const roleSelect = document.getElementById("role");
const roleCodeFields = document.getElementById("roleCodeFields");
const roleCodeLegend = document.getElementById("roleCodeLegend");
const roleCodeHelp = document.getElementById("roleCodeHelp");
const roleCodeLabel = document.getElementById("roleCodeLabel");
const roleCodeInput = document.getElementById("roleCode");

function storeUserSession(user, profile = {}) {
    localStorage.setItem("userId", user.uid);
    localStorage.setItem("userEmail", profile.email || user.email || "");
    localStorage.setItem("userRole", profile.role || "");

    if (profile.role === "patient") {
        localStorage.setItem("patientId", user.uid);
    } else {
        localStorage.removeItem("patientId");
    }
}

function updateRoleCodeField() {
    const role = roleSelect.value;
    const needsCode = role === "admin" || role === "staff";

    roleCodeFields.hidden = !needsCode;
    roleCodeFields.setAttribute("aria-hidden", String(!needsCode));
    roleCodeInput.required = needsCode;

    if (!needsCode) {
        roleCodeInput.value = "";
        return;
    }

    const isAdmin = role === "admin";
    roleCodeLegend.textContent = isAdmin ? "Admin Verification" : "Staff Verification";
    roleCodeHelp.textContent = isAdmin
        ? "Your clinic ID will be retrieved automatically from your admin code."
        : "Your clinic assignment will be retrieved automatically from your staff code.";
    roleCodeLabel.textContent = isAdmin ? "Admin Code" : "Staff Code";
    roleCodeInput.placeholder = isAdmin ? "Enter your admin code" : "Enter your staff code";
}

auth.onAuthStateChanged((user) => {
    if (!user) {
        console.warn("No session - redirecting to login");
        window.location.href = "login.html";
    }
});

roleSelect.addEventListener("change", updateRoleCodeField);
updateRoleCodeField();

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

    const role = roleSelect.value;
    const roleCode = roleCodeInput.value.trim();

    const userData = {
        uid: user.uid,
        fullName: user.displayName || "Unknown User",
        email: user.email,
        role,
        phone: document.getElementById("phone").value
    };

    if (role === "admin") {
        userData.adminCode = roleCode;
    }

    if (role === "staff") {
        userData.staffCode = roleCode;
    }

    try {
        const response = await fetch("/api/user/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Something went wrong");
        }

        storeUserSession(user, result.profile || userData);
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Error creating user profile:", error);
        alert("Error: " + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalize Account";
    }
});
