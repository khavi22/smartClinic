// dashboard.js — auth guard, user display, logout, delete account
// clinics.js handles all clinic search logic independently

const auth = firebase.auth();
const db   = firebase.firestore();

auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    await loadUserProfile(user);
});

async function loadUserProfile(user) {
    try {
        const doc = await db.collection("users").doc(user.uid).get();

        if (!doc.exists) {
            window.location.href = "signUp.html";
            return;
        }

        const data = doc.data();
        const firstName = (data.fullName || "there").split(" ")[0];

        // Show avatar
        const avatar = document.getElementById("userAvatar");
        if (user.photoURL) {
            avatar.src    = user.photoURL;
            avatar.hidden = false;
        }

        // Show greeting
        const greeting = document.getElementById("userGreeting");
        greeting.textContent = `Hi, ${firstName}`;
        greeting.hidden = false;

        // Show logout button
        document.getElementById("logoutBtn").hidden = false;

    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

// ── LOGOUT ──────────────────────────────────────────────────
document.getElementById("logoutBtn").addEventListener("click", () => {
    auth.signOut().then(() => window.location.href = "login.html");
});

// ── DELETE ACCOUNT ──────────────────────────────────────────
const deleteModal  = document.getElementById("deleteModal");
const modalConfirm = document.getElementById("modalConfirm");
const confirmText  = document.getElementById("confirmText");

document.getElementById("deleteAccBtn").addEventListener("click", () => {
    deleteModal.showModal();
});

document.getElementById("modalCancel").addEventListener("click", () => {
    deleteModal.close();
});

// Close on backdrop click
deleteModal.addEventListener("click", (e) => {
    if (!deleteModal.querySelector(".modal-box").contains(e.target)) {
        deleteModal.close();
    }
});

// Confirm deletion
modalConfirm.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) { window.location.href = "login.html"; return; }

    modalConfirm.disabled   = true;
    confirmText.textContent = "Deleting…";

    try {
        // 1. Delete Firestore record
        await db.collection("patients").doc(user.uid).delete();

        // 2. Delete Auth account (re-auth if session is stale)
        try {
            await user.delete();
        } catch (authErr) {
            if (authErr.code === "auth/requires-recent-login") {
                const provider = new firebase.auth.GoogleAuthProvider();
                await auth.signInWithPopup(provider);
                await auth.currentUser.delete();
            } else {
                throw authErr;
            }
        }

        window.location.href = "index.html";

    } catch (err) {
        console.error("Delete account error:", err);
        alert("Could not delete account: " + err.message);
        modalConfirm.disabled   = false;
        confirmText.textContent = "Yes, Delete";
    }
});

