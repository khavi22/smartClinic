// --- Firebase Config (Copy from login.js) ---
const firebaseConfig = {
    apiKey: "AIzaSyDWr5lA9QgmKZLl5M8ctDKQWqS7yOFn_LY",
    authDomain: "smartclinic-11971.firebaseapp.com",
    projectId: "smartclinic-11971",
    storageBucket: "smartclinic-11971.firebasestorage.app",
    messagingSenderId: "301262646979",
    appId: "1:301262646979:web:6529009c676257565a7c76"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 1. Monitor Auth State
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log("Logged in as:", user.email);
        loadUserProfile(user);
    } else {
        // Not logged in - kick to login page
        window.location.href = "login.html";
    }
});

// 2. Load User Data and Toggle UI
async function loadUserProfile(user) {
    try {
        const doc = await db.collection("patients").doc(user.uid).get();
        
        if (doc.exists) {
            const userData = doc.data();
            
            // Update UI Elements
            document.getElementById("greeting").innerText = `Hello, ${userData.fullName}`;
            document.getElementById("displayRole").innerText = userData.role;
            document.getElementById("userAvatar").src = userData.profilePic || user.photoURL;

            // Role-Based Toggle
            if (userData.role === "Patient") {
                document.getElementById("patientView").style.display = "block";
                document.querySelectorAll(".patient-only").forEach(el => el.style.display = "block");
            } else if (userData.role === "Staff") {
                document.getElementById("staffView").style.display = "block";
                document.querySelectorAll(".staff-only").forEach(el => el.style.display = "block");
                loadStaffQueue(); // Specific staff function
            }
        } else {
            // Document missing? Send to signup
            window.location.href = "signup.html";
        }
    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}

// 3. Staff Specific: Load Queue Data
async function loadStaffQueue() {
    const queueBody = document.getElementById("queueBody");
    // This looks at the 'bookings' collection from your screenshot
    const snapshot = await db.collection("bookings").where("status", "==", "booked").get();
    
    queueBody.innerHTML = ""; // Clear loader
    snapshot.forEach(doc => {
        const booking = doc.data();
        queueBody.innerHTML += `
            <tr>
                <td>${booking.patientId}</td>
                <td>${booking.timeSlot}</td>
                <td><span class="status-tag">${booking.status}</span></td>
                <td><button onclick="updateStatus('${doc.id}')">Check In</button></td>
            </tr>
        `;
    });
}

// 4. Logout Logic
document.getElementById("logoutBtn").addEventListener("click", () => {
    auth.signOut().then(() => {
        window.location.href = "login.html";
    });
});