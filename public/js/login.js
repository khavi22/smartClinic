const auth = firebase.auth();
const db   = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let signingIn = false;

function storeUserSession(user, profile) {
    localStorage.setItem("userId", user.uid);
    localStorage.setItem("userEmail", profile?.email || user.email || "");

    if (profile?.role) {
        localStorage.setItem("userRole", profile.role);
    } else {
        localStorage.removeItem("userRole");
    }

    if (profile?.role === "patient") {
        localStorage.setItem("patientId", user.uid);
    } else {
        localStorage.removeItem("patientId");
    }
}

async function redirectBasedOnUser(user) {
    try {
        // Force refresh the token to get the latest custom claims (roles)
        try {
            await user.getIdTokenResult(true);
        } catch (tokenError) {
            console.error("Token refresh failed. Session likely expired:", tokenError);
            await auth.signOut();
            return;
        }
        
        const emailQuery = encodeURIComponent(user.email || "");
        const response = await fetch(`/api/user/login/${user.uid}?email=${emailQuery}`);
        
        if (response.status === 401 || response.status === 403) {
            console.warn("Backend rejected session. Signing out.");
            await auth.signOut();
            return;
        }

        const data = await response.json();

        if (response.ok && data.exists) {
            if (data.pending) {
                alert(data.message || "Your account is awaiting admin approval.");
                await auth.signOut();
                return;
            }
            if (data.rejected) {
                alert(data.message || "Your staff application was declined.");
                await auth.signOut();
                return;
            }

            storeUserSession(user, data.profile);
            
            const serverRedirect = data.redirect ? (data.redirect.startsWith("/") ? data.redirect.substring(1) : data.redirect) : null;
            
            if (serverRedirect) {
                console.log("Redirecting to server-specified path:", serverRedirect);
                window.location.href = serverRedirect;
                return;
            }

            const idTokenResult = await user.getIdTokenResult(true);
            const role = idTokenResult.claims.role;
            if (role) {
                const claimRedirect = role === "admin" ? "adminDashboard.html" : "dashboard.html";
                window.location.href = claimRedirect;
                return;
            }

            window.location.href = "dashboard.html";
        } else {
            console.log("No profile found. Redirecting to signUp.html");
            window.location.href = "signUp.html";
        }
    } catch (error) {
        console.error("User check failed:", error);
        
        if (error.code === 'auth/network-request-failed') {
            alert("Network error: Please check your internet connection or ensure localhost:3000 is whitelisted in Firebase Console.");
        } else {
            alert("Session validation failed. Signing out to retry.");
        }
        
        await auth.signOut();
    }
}



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
