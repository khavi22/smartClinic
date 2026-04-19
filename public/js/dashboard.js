// dashboard.js - auth guard, user display, logout, delete account
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
const db = firebase.firestore();
const ROLE_COLLECTIONS = ["patients", "admins", "staff"];

auth.onAuthStateChanged(async (user) => {
    if (user) {
        await loadUserProfile(user);
    } else {
        window.location.href = "login.html";
    }
});

async function loadUserProfile(user) {
    try {
        let doc = null;

        for (const collectionName of ROLE_COLLECTIONS) {
            const candidateDoc = await db.collection(collectionName).doc(user.uid).get();

            if (candidateDoc.exists) {
                doc = candidateDoc;
                break;
            }
        }

        if (!doc || !doc.exists) {
            window.location.href = "signUp.html";
            return;
        }

        const data = doc.data();
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
        if (user.photoURL) {
            avatar.src = user.photoURL;
            avatar.hidden = false;
        }

        const greeting = document.getElementById("userGreeting");
        greeting.textContent = `Hi, ${firstName}`;
        greeting.hidden = false;

        document.getElementById("logoutBtn").hidden = false;
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

document.getElementById("logoutBtn").addEventListener("click", () => {
    auth.signOut().then(() => {
        window.location.href = "login.html";
    });
});

const deleteModal = document.getElementById("deleteModal");
const modalConfirm = document.getElementById("modalConfirm");
const confirmText = document.getElementById("confirmText");

document.getElementById("deleteAccBtn").addEventListener("click", () => {
    deleteModal.showModal();
});

document.getElementById("modalCancel").addEventListener("click", () => {
    deleteModal.close();
});

deleteModal.addEventListener("click", (e) => {
    if (!deleteModal.querySelector(".modal-box").contains(e.target)) {
        deleteModal.close();
    }
});

modalConfirm.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    modalConfirm.disabled = true;
    confirmText.textContent = "Deleting...";

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
        alert("Could not delete account: " + err.message);
        modalConfirm.disabled = false;
        confirmText.textContent = "Yes, Delete";
    }
});
