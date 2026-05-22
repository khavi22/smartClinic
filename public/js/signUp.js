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
    const isAdmin = role === "admin";

    // Explicitly toggle display to avoid browser-specific hidden attribute bugs
    roleCodeFields.style.display = isAdmin ? "block" : "none";
    roleCodeFields.setAttribute("aria-hidden", String(!isAdmin));
    roleCodeInput.required = isAdmin;

    if (!isAdmin) {
        roleCodeInput.value = "";
        return;
    }

    roleCodeLegend.textContent = "Admin Verification";
    roleCodeLabel.textContent = "Admin Code";
}

updateRoleCodeField();
roleSelect.addEventListener("change", updateRoleCodeField);

// --- Auth Guard ---
auth.onAuthStateChanged(user => {
    if (!user) {
        console.warn("No active session found on signUp.html. Redirecting...");
        window.location.href = "index.html";
    }
});

signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const user = auth.currentUser;

    if (!user) {
        showToast("Session expired. Please log in again.", "error");
        window.location.href = "index.html";
        return;
    }

    const role = roleSelect.value;
    const roleCode = roleCodeInput.value.trim();

    if (role === "admin" && !roleCode) {
        showToast("Please enter your admin verification code.", "error");
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
        showToast("Error: " + error.message, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Finalize Account";
    }
});
