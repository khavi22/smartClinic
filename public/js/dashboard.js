// dashboard.js — auth guard, user display, logout, delete account
// clinics.js handles all clinic search logic independently

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
const db   = firebase.firestore();

// ── AUTH GUARD ──────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
    if (user) {
        await loadUserProfile(user);
    } else {
        window.location.href = "login.html";
    }
});

// ── LOAD PROFILE → populate nav ─────────────────────────────
async function loadUserProfile(user) {
    try {
        const doc = await db.collection("patients").doc(user.uid).get();

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
