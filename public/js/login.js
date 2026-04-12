const firebaseConfig = {
  apiKey: "AIzaSyDWr5lA9QgmKZLl5M8ctDKQWqS7yOFn_LY",
  authDomain: "smartclinic-11971.firebaseapp.com",
  projectId: "smartclinic-11971",
  storageBucket: "smartclinic-11971.firebasestorage.app",
  messagingSenderId: "301262646979",
  appId: "1:301262646979:web:6529009c676257565a7c76",
  measurementId: "G-CZ0M6NZFV6"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// Flag to prevent onAuthStateChanged from redirecting
// while the Google sign-in popup is in progress
let signingIn = false;

// If user is already signed in when the page loads,
// check Firestore and redirect them automatically
auth.onAuthStateChanged(async (user) => {
    if (signingIn) return; // Don't interfere with an active sign-in

    if (user) {
        console.log("Already logged in:", user.uid);
        await redirectBasedOnProfile(user);
    }
});

// Check Firestore for an existing patient record and redirect accordingly
async function redirectBasedOnProfile(user) {
    try {
        const doc = await db.collection("patients").doc(user.uid).get();
        if (doc.exists) {
            console.log("Existing user — going to dashboard");
            window.location.href = "dashboard.html";
        } else {
            console.log("New user — going to sign up");
            window.location.href = "signUp.html";
        }
    } catch (error) {
        console.error("Firestore check failed:", error);
        alert("Permission Error: Check your Firestore Rules!\n\n" + error.message);
    }
}

// Google Sign-In button
const googleBtn = document.getElementById("googleLogin");

if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
        signingIn = true; // Block onAuthStateChanged redirect during popup
        googleBtn.disabled = true;
        googleBtn.querySelector("span").textContent = "Signing in...";

        try {
            const result = await auth.signInWithPopup(provider);
            console.log("Signed in as:", result.user.uid);
            await redirectBasedOnProfile(result.user);
        } catch (error) {
            console.error("Login failed:", error);
            if (error.code !== "auth/popup-closed-by-user") {
                alert("Sign-in failed: " + error.message);
            }
            // Reset button so user can try again
            signingIn = false;
            googleBtn.disabled = false;
            googleBtn.querySelector("span").textContent = "Continue with Google";
        }
    });
}

function goBack() {
    window.location.href = "index.html";
}
