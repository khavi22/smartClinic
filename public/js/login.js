const auth = firebase.auth();
const db   = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

let signingIn = false;

async function redirectBasedOnUser(user) {
    try {
        // Force refresh the token to get the latest custom claims (roles)
        const idTokenResult = await user.getIdTokenResult(true);
        const role = idTokenResult.claims.role;

        if (role) {
            const redirectUrl = role === "admin" ? "adminDashboard.html" : "dashboard.html";
            console.log("Redirecting to dashboard based on claim:", redirectUrl);
            window.location.href = redirectUrl;
            localStorage.setItem("patientId", user.uid);
            return;
        }

        // Fallback: If no claim yet, check the legacy endpoint
        console.log("No claim found. Checking legacy database endpoint...");
        const response = await fetch(`/api/user/login/${user.uid}`);
        const data = await response.json();

        if (response.ok && data.redirect) {
            // Remove leading slash if present for relative navigation
            const target = data.redirect.startsWith("/") ? data.redirect.substring(1) : data.redirect;
            console.log("Redirecting to database-suggested path:", target);
            window.location.href = target;
            localStorage.setItem("patientId", user.uid);
        } else {
            // New user — needs to sign up
            console.log("No role or profile found. Redirecting to signUp.html");
            window.location.href = "signUp.html";
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