// Navigation Handling
document.addEventListener('DOMContentLoaded', () => {
    const getStartedBtn = document.getElementById("getStartedBtn");
    
    if (getStartedBtn) {
        getStartedBtn.addEventListener("click", () => {
            console.log("Navigating to dashboard...");
        });
    }
});