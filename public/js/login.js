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

const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

let signingIn = false;

async function redirectBasedOnUser(user) {
    try {
        const response = await fetch(`/api/user/login/${user.uid}`);
        const data = await response.json();

        if (response.ok && data.redirect) {
            window.location.href = data.redirect;
            localStorage.setItem("patientId", user.uid);
        } else {
            alert(data.error || "Failed to check user login");
        }
    } catch (error) {
        console.error("User check failed:", error);
        alert("Something went wrong while checking login.");
    }
}

auth.onAuthStateChanged(async (user) => {
    if (signingIn) return;

    if (user) {
        console.log("Already logged in:", user.uid);
        await redirectBasedOnUser(user);
    }
});

const googleBtn = document.getElementById("googleLogin");

if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
        signingIn = true;
        googleBtn.disabled = true;

        const span = googleBtn.querySelector("span");
        if (span) {
            span.textContent = "Signing in...";
        }

        try {
            const result = await auth.signInWithPopup(provider);
            console.log("Signed in as:", result.user.uid);
            await redirectBasedOnUser(result.user);
        } catch (error) {
            console.error("Login failed:", error);

            if (error.code !== "auth/popup-closed-by-user") {
                alert("Sign-in failed: " + error.message);
            }

            signingIn = false;
            googleBtn.disabled = false;

            if (span) {
                span.textContent = "Continue with Google";
            }
        }
    });
}

function goBack() {
    window.location.href = "index.html";
}