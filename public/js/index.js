const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

let signingIn = false;

// Saves the signed-in user's core profile details so other pages can identify
// their role without repeating the login lookup immediately.
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

// Validates the Firebase user against the backend profile and sends them to
// the correct dashboard, signup page, or pending/rejected staff message.
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
        
        // Check if there's a returnTo parameter in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const returnTo = urlParams.get('returnTo');
        
        if (returnTo) {
            console.log("Returning to specified page:", returnTo);
            window.location.href = returnTo;
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
                showToast(data.message || "Your account is awaiting admin approval.", "info");
                await auth.signOut();
                return;
            }
            if (data.rejected) {
                showToast(data.message || "Your staff application was declined.", "error");
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
            showToast("Network error: Please check your internet connection.", "error");
        } else {
            showToast("Session validation failed. Signing out to retry.", "error");
        }
        
        await auth.signOut();
    }
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const getStartedBtn = document.getElementById("getStartedBtn");
    
    if (getStartedBtn) {
        getStartedBtn.addEventListener("click", async () => {
            signingIn = true;
            getStartedBtn.disabled = true;

            const span = getStartedBtn.querySelector("span");
            const originalText = span ? span.textContent : "Get Started Now";
            
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
                    showToast("Sign-in failed: " + error.message, "error");
                }

                signingIn = false;
                getStartedBtn.disabled = false;

                if (span) {
                    span.textContent = originalText;
                }
            }
        });
    }
});

