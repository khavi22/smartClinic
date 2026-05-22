// dashboard.js - auth guard, user display, logout, delete account
// clinics.js handles all clinic search logic independently

const auth = firebase.auth();
const db = firebase.firestore();
const ROLE_COLLECTIONS = ["patients", "admins", "staff", "users"];

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        console.log("Dashboard Guard: No active user session found.");
        window.location.href = "index.html";
        return;
    }
    console.log("Dashboard Guard: Session detected for UID:", user.uid);
    await loadUserProfile(user);
});

// Loads the authenticated user's backend profile, enforces that patients stay
// on the patient dashboard, and fills the header/session UI.
async function loadUserProfile(user) {
    try {
        let doc = null;

        console.log("Dashboard: Fetching profile from server API...");
        
        // We fetch from our own backend which has Admin SDK permissions
        // This bypasses the "Permission Denied" errors in the browser.
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/user/login/${user.uid}?email=${encodeURIComponent(user.email || "")}`, {
            headers: {
                "Authorization": `Bearer ${idToken}`
            }
        });

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const result = await response.json();

        if (result.exists && result.profile) {
            console.log("Dashboard: SUCCESS - Profile received from server.");
            // Create a mock doc-like object to maintain compatibility with existing logic
            const data = result.profile;
            const firstName = (data.fullName || "there").split(" ")[0];
            
            // Re-map it to look like a Firestore doc match for the rest of the script
            doc = { exists: true, data: () => data };
        } else {
            console.error("Dashboard: Server says profile does not exist.");
            window.location.href = "signUp.html";
            return;
        }

        const data = doc.data();
        
        // --- SMART REDIRECT GUARD ---
        // If the user's role doesn't match this current page (dashboard.html is for patients), send them home.
        const currentPage = window.location.pathname.split("/").pop();
        if (currentPage === "dashboard.html") {
            if (data.role === "admin") {
                window.location.href = "adminDashboard.html";
                return;
            } else if (data.role === "staff") {
                window.location.href = "staffDashboard.html";
                return;
            }
        }
        const firstName = (data.fullName || "there").split(" ")[0];

        localStorage.setItem("userId", user.uid);
        localStorage.setItem("userEmail", data.email || user.email || "");
        localStorage.setItem("userRole", data.role || "");

        if (data.role === "patient") {
            localStorage.setItem("patientId", user.uid);
        } else {
            localStorage.removeItem("patientId");
        }

        const avatar = document.getElementById("userAvatar");
        if (avatar && user.photoURL) {
            avatar.src = user.photoURL;
            avatar.hidden = false;
        }

        const greeting = document.getElementById("userGreeting");
        if (greeting) {
            greeting.textContent = `Hi, ${firstName}`;
            greeting.hidden = false;
        }

        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) logoutBtn.hidden = false;



    } catch (err) {
        console.error("Error loading profile:", err);
        showToast("Session verification failed. Redirecting to home.", "error");
        await auth.signOut();
        window.location.href = "index.html";
    }
}

const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        auth.signOut().then(() => {
            window.location.href = "index.html";
        });
    });
}

const deleteModal = document.getElementById("deleteModal");
const modalConfirm = document.getElementById("modalConfirm");
const confirmText = document.getElementById("confirmText");
const deleteAccBtn = document.getElementById("deleteAccBtn");

if (deleteAccBtn) {
    deleteAccBtn.addEventListener("click", () => {
        if (deleteModal) deleteModal.showModal();
    });
}

const modalCancel = document.getElementById("modalCancel");
if (modalCancel) {
    modalCancel.addEventListener("click", () => {
        if (deleteModal) deleteModal.close();
    });
}

if (deleteModal) {
    deleteModal.addEventListener("click", (e) => {
        const box = deleteModal.querySelector(".modal-box");
        if (box && !box.contains(e.target)) {
            deleteModal.close();
        }
    });
}

if (modalConfirm) {
    modalConfirm.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        modalConfirm.disabled = true;
        if (confirmText) confirmText.textContent = "Deleting...";

        try {
            const idToken = await user.getIdToken(true);
            const response = await fetch("/api/user/account", {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Failed to delete account");
            }

            localStorage.removeItem("userId");
            localStorage.removeItem("userEmail");
            localStorage.removeItem("userRole");
            localStorage.removeItem("patientId");

            try {
                await auth.signOut();
            } catch (signOutError) {
                console.warn("Sign out after account deletion failed:", signOutError);
            }

            window.location.href = "index.html";
        } catch (err) {
            console.error("Delete account error:", err);
            showToast("Could not delete account: " + err.message, "error");
            modalConfirm.disabled = false;
            if (confirmText) confirmText.textContent = "Yes, Delete";
        }
    });
}


