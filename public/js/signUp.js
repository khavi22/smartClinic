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
    const isSpecialRole = role === "admin" || role === "staff";

    // Explicitly toggle display to avoid browser-specific hidden attribute bugs
    roleCodeFields.style.display = isSpecialRole ? "block" : "none";
    roleCodeFields.setAttribute("aria-hidden", String(!isSpecialRole));
    roleCodeInput.required = isSpecialRole;

    if (!isSpecialRole) {
        roleCodeInput.value = "";
        return;
    }

    const isAdmin = role === "admin";
    roleCodeLegend.textContent = isAdmin ? "Admin Verification" : "Staff Verification";
    roleCodeLabel.textContent = isAdmin ? "Admin Code" : "Staff Code";
}

updateRoleCodeField();
roleSelect.addEventListener("change", updateRoleCodeField);

// --- Auth Guard ---
auth.onAuthStateChanged(user => {
    if (!user) {
        console.warn("No active session found on signUp.html. Redirecting...");
        window.location.href = "login.html";
    }
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
    const roleCode = roleCodeInput.value.trim();

    if ((role === "admin" || role === "staff") && !roleCode) {
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
        verificationCode: roleCode || null
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
        storeUserSession(user, result.profile || registrationData);
        
        // Wait for token refresh then redirect to the correct dashboard
        await user.getIdToken(true);
        window.location.href = result.redirect || "dashboard.html";

    } catch (error) {
        console.error("Error during registration:", error);
        alert("Error: " + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalize Account";
    }
});
