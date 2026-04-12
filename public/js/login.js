const firebaseConfig = {
  apiKey: "AIzaSyDWr5lA9QgmKZLl5M8ctDKQWqS7yOFn_LY",
  //authDomain: "localhost",
  authDomain: "smartclinic-11971.firebaseapp.com", //i changed to this for local testing 
  projectId: "smartclinic-11971",
  storageBucket: "smartclinic-11971.firebasestorage.app",
  messagingSenderId: "301262646979",
  appId: "1:301262646979:web:6529009c676257565a7c76",
  measurementId: "G-CZ0M6NZFV6"
};


if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); 
}
const db = firebase.firestore();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

const googleBtn = document.getElementById("googleLogin");

if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
        try {
            const result = await auth.signInWithPopup(provider);
            const user = result.user;

            console.log("Checking for user:", user.uid);

            // TRY TO GET THE DOC
            const doc = await db.collection("patients").doc(user.uid).get();

            if (doc.exists) {
                console.log("User exists! Sending to Dashboard...");
                window.location.href = "dashboard.html";
            } else {
                console.log("New user! Sending to Sign Up...");
                window.location.href = "signUp.html";
            }
        } catch (error) {
            console.error("Login Check Failed:", error);
            // If permissions fail here, it will never find the user
            alert("Permission Error: Check your Firestore Rules!");
        }
    });
}
// Helper Function
function goBack() {
    window.location.href = "index.html";
}