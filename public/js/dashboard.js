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

// ── LOAD PROFILE ────────────────────────────────────────────
async function loadUserProfile(user) {
    try {
        const doc = await db.collection("patients").doc(user.uid).get();

        if (!doc.exists) {
            window.location.href = "signUp.html";
            return;
        }

        const data = doc.data();
        const firstName = (data.fullName || "there").split(" ")[0];

        document.getElementById("greeting").innerHTML =
            `Hello, <span>${firstName}</span> 👋`;

        const badge = document.getElementById("displayRole");
        badge.textContent = data.role;
        if (data.role === "Staff") badge.classList.add("staff");

        const avatar = document.getElementById("userAvatar");
        avatar.src = data.profilePic || user.photoURL || "";
        avatar.alt = data.fullName;

        if (data.role === "Patient") {
            document.getElementById("patientView").hidden = false;
            document.querySelectorAll(".patient-only").forEach(el => el.hidden = false);
        } else if (data.role === "Staff") {
            document.getElementById("staffView").hidden = false;
            document.querySelectorAll(".staff-only").forEach(el => el.hidden = false);
            loadStaffQueue();
        }

    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

// ── STAFF QUEUE ─────────────────────────────────────────────
async function loadStaffQueue() {
    const queueBody = document.getElementById("queueBody");
    if (!queueBody) return;

    try {
        const snapshot = await db.collection("bookings")
            .where("status", "==", "booked").get();

        if (snapshot.empty) {
            queueBody.innerHTML = `<tr><td colspan="4" class="table-empty">No bookings for today</td></tr>`;
            return;
        }

        queueBody.innerHTML = "";
        snapshot.forEach(doc => {
            const b = doc.data();
            queueBody.innerHTML += `
                <tr>
                    <td>${b.patientId || "—"}</td>
                    <td>${b.timeSlot  || "—"}</td>
                    <td><span class="status-tag">${b.status}</span></td>
                    <td><button class="checkin-btn" type="button" onclick="updateStatus('${doc.id}')">Check In</button></td>
                </tr>`;
        });
    } catch (err) {
        console.error("Error loading queue:", err);
    }
}

// ── LOGOUT ──────────────────────────────────────────────────
document.getElementById("logoutBtn").addEventListener("click", (e) => {
    e.preventDefault();
    auth.signOut().then(() => window.location.href = "login.html");
});

// ── DELETE ACCOUNT ──────────────────────────────────────────
const deleteModal  = document.getElementById("deleteModal");
const confirmText  = document.getElementById("confirmText");
const modalConfirm = document.getElementById("modalConfirm");

// Open — native dialog API
document.getElementById("deleteAccBtn").addEventListener("click", () => {
    deleteModal.showModal();
});

// Close via Cancel
document.getElementById("modalCancel").addEventListener("click", () => {
    deleteModal.close();
});

// Close on backdrop click — check if click landed outside .modal-box
deleteModal.addEventListener("click", (e) => {
    const box = deleteModal.querySelector(".modal-box");
    if (!box.contains(e.target)) deleteModal.close();
});

// Confirm deletion
modalConfirm.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) { window.location.href = "login.html"; return; }

    modalConfirm.disabled  = true;
    confirmText.textContent = "Deleting…";

    try {
        // 1. Remove Firestore record
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
