console.log("signUp.js loaded");

const auth = firebase.auth();
const db   = firebase.firestore();

auth.onAuthStateChanged((user) => {
    if (!user) {
        console.warn("No session — redirecting to login");
        window.location.href = "login.html";
    }
});

const signupForm = document.getElementById("signupForm");
const roleSelect = document.getElementById("role");
const verificationFields = document.getElementById("verificationFields");
const verificationHint = document.getElementById("verificationHint");
const verificationLabel = document.getElementById("verificationLabel");

roleSelect.addEventListener("change", () => {
    const role = roleSelect.value;
    const needsCode = (role === "admin" || role === "staff");

    verificationFields.hidden = !needsCode;
    verificationFields.setAttribute("aria-hidden", String(!needsCode));

    if (role === "admin") {
        verificationLabel.textContent = "Admin Verification Code";
        verificationHint.textContent = "Enter the Admin Code associated with your clinic (starts with ADM-).";
    } else if (role === "staff") {
        verificationLabel.textContent = "Staff Registration Code";
        verificationHint.textContent = "Enter the Staff Code provided by your Clinic Administrator (starts with STF-).";
    }

    if (!needsCode) document.getElementById("verificationCode").value = "";
});

signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
        alert("Session expired. Please log in again.");
        window.location.href = "login.html";
        return;
    }

    const role = roleSelect.value;
    const verificationCode = document.getElementById("verificationCode").value.trim();

    if ((role === "admin" || role === "staff") && !verificationCode) {
        alert(`Please enter your ${role} verification code.`);
        return;
    }

    const submitBtn = signupForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving Profile...";

    const registrationData = {
        uid: user.uid,
        fullName: user.displayName || "Unknown User",
        email: user.email,
        role: role,
        phone: document.getElementById("phone").value,
        idNumber: document.getElementById("idNumber").value || "N/A",
        verificationCode: verificationCode || null
    };

    try {
        const response = await fetch("/api/user/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(registrationData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Something went wrong during registration.");
        }

        console.log(`${role} record created successfully!`);
        
        await user.getIdToken(true);
        window.location.href = result.redirect || "dashboard.html";

    } catch (error) {
        console.error("Error during registration:", error);
        alert("Error: " + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalize Account";
    }
});