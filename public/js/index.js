// navigations
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
    loginBtn.addEventListener("click", () => {
        window.location.href = "login.html";
        // trying to deploy on azure but cant find this repository
        
    })
}
// Navigation Handling
document.addEventListener('DOMContentLoaded', () => {
    const getStartedBtn = document.getElementById("getStartedBtn");
    
    if (getStartedBtn) {
        getStartedBtn.addEventListener("click", () => {
            console.log("Navigating to dashboard...");
        });
    }
});
