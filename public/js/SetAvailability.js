const today = new Date();
let currentViewMonth = today.getMonth();
let currentViewYear = today.getFullYear();
let selectedDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
let selectedDates = [];

//will work maybe maybe next  month but  the project is due tomorrow
// const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
// const daysLeftInMonth = daysInCurrentMonth - currentDate;
// const showNextMonth = daysLeftInMonth <= 5;

function renderCalendar() {
    const container = document.getElementById('SetAvailabilitycalendarContainer');
    if (!container) return;

    const monthName = new Date(currentViewYear, currentViewMonth).toLocaleString('default', { month: 'long' });

    let html = `
        <header class="cal-header">
            <button class="cal-nav-btn" onclick="window.changeMonth(-1)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M15 18l-6-6 6-6" />
                </svg>
            </button>
            <span class="month-title">${monthName} ${currentViewYear}</span>
            <button class="cal-nav-btn" onclick="window.changeMonth(1)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </button>
        </header>
        <section class="cal-grid">
            <span class="cal-day-label">Su</span>
            <span class="cal-day-label">Mo</span>
            <span class="cal-day-label">Tu</span>
            <span class="cal-day-label">We</span>
            <span class="cal-day-label">Th</span>
            <span class="cal-day-label">Fr</span>
            <span class="cal-day-label">Sa</span>
    `;

    const firstDayOfMonth = new Date(currentViewYear, currentViewMonth, 1).getDay();
    const daysInMonth = new Date(currentViewYear, currentViewMonth + 1, 0).getDate();

    for (let i = 0; i < firstDayOfMonth; i++) {
        html += '<span class="cal-day empty"></span>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(currentViewYear, currentViewMonth, day);
        const dateStr = `${currentViewYear}-${(currentViewMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        const isSelected = selectedDates.includes(dateStr);
        const isToday = dateObj.toDateString() === today.toDateString();
        const isPast = dateObj < today && !isToday;

        html += `
            <button type="button" class="cal-day ${isSelected ? 'selected' : ''} ${!isPast ? 'available' : ''} ${isToday ? 'today' : ''} ${isPast ? 'disabled' : ''}" 
                 onclick="${isPast ? '' : `window.handleDateSelection('${dateStr}')`}">
                <time datetime="${dateStr}">${day}</time>
            </button>
        `;
    }

    const totalSlotsUsed = firstDayOfMonth + daysInMonth;
    const remainingSlots = (7 - (totalSlotsUsed % 7)) % 7;
    for (let i = 0; i < remainingSlots; i++) {
        html += '<span class="cal-day empty"></span>';
    }

    html += '</section>';
    container.innerHTML = html;
}

window.handleDateSelection = function(dateStr) {
    selectedDate = dateStr;
    if (selectedDates.includes(dateStr)) {
        selectedDates = selectedDates.filter(d => d !== dateStr);
    } else {
        selectedDates.push(dateStr);
    }
    renderCalendar();
    const display = document.getElementById("selected-date-display");
    const value = document.getElementById("selected-date-value");
    
    if(selectedDates.length > 0){
        display.style.display = "block";
        const lastSelected = selectedDates[selectedDates.length - 1];
        value.textContent = new Date(lastSelected).toLocaleDateString('default', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else {
        display.style.display = "none";
    }
    console.log("Selected dates:", selectedDates);
};

window.changeMonth = function(delta) {
    // i will just make all months available for testing and demonstration
    currentViewMonth += delta;
    if (currentViewMonth > 11) { currentViewMonth = 0; currentViewYear++; }
    else if (currentViewMonth < 0) { currentViewMonth = 11; currentViewYear--; }
    //but this is the idea of showing a  month 5 days before it starts
    // let newMonth = currentViewMonth + delta;
    // let newYear = currentViewYear;
    //reset to january after reaching deccember
    // if (newMonth > 11) { 
    //     newMonth = 0; 
    //     newYear++; 
    // } else if (newMonth < 0) { 
    //     newMonth = 11; 
    //     newYear--; 
    // }
    
    // // Check if trying to go to next month
    // if (delta > 0) {
    //     // Calculate which month we're trying to go to
    //     const targetMonth = newMonth;
    //     const targetYear = newYear;
        
    //     // block if trying to go beyond next month
    //     if (targetYear > currentYear || (targetYear === currentYear && targetMonth > currentMonth + 1)) {
    //         alert("Cannot view months beyond next month");
    //         return;
    //     }
        
    //     // block next month if not yet within 5 days of it starting
    //     if (targetMonth === currentMonth + 1 && !showNextMonth) {
    //         const daysUntilNextMonth = daysLeftInMonth;
    //         alert(`Next month will be available in ${daysUntilNextMonth} days`);
    //         return;
    //     }
    // }
    
    // // block the past months
    // if (delta < 0) {
    //     if (newYear < currentYear || (newYear === currentYear && newMonth < currentMonth)) {
    //         alert("Cannot view past months");
    //         return;
    //     }
    // }
    
    // currentViewMonth = newMonth;
    // currentViewYear = newYear;
    
   
    renderCalendar();


};

//save to firestore
async function saveAvailabilityToBackend(startTime, endTime, checkedValue) {
    //const staffCode = "STF-330AFB";
    // const staffCode="J96HrT5YN3VOAAzNGqEhpxj4vUx2";
    const user = firebase.auth().currentUser;
    // console.log("user:", user);          // check if user is logged in
    // console.log("staffCode:", user ? user.uid : "NO USER"); // check uid
    // console.log("selectedDates:", selectedDates); // check dates
    // console.log("startTime:", startTime);
    console.log("endTime:", endTime);
    const staffCode = user ? user.uid : "J96HrT5YN3VOAAzNGqEhpxj4vUx2";
    
    // later: localStorage.getItem("staffCode");
    
    const response = await fetch("/api/staff/availability/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            staffCode: staffCode,
            dates: selectedDates,   
            startTime: startTime,    
            endTime: endTime,        
            available: checkedValue 
})
    });

    const data = await response.json();

    if(response.ok){
        showToast("Availability saved successfully!", "success");
        selectedDates = [];
        renderCalendar();
        LoadAvailability();
    } else {
        showToast("Error: " + data.error, "error");
    }
}

// get data from firestore
async function LoadAvailability() {
    // const staffCode = "STF-330AFB";
    // const staffCode="J96HrT5YN3VOAAzNGqEhpxj4vUx2";
    // later: localStorage.getItem("staffCode");
    const user = firebase.auth().currentUser;
    const staffCode = user ? user.uid : "J96HrT5YN3VOAAzNGqEhpxj4vUx2";

    try {
        const response = await fetch(`/api/staff/availability/${staffCode}`);
        const data = await response.json();
        const availability = data.availability;
        displayAvailability(availability);
    } catch(error) {
        console.error("Error loading availability:", error);
    }
}


function displayAvailability(availability) {
    const display = document.getElementById("Availability_content");
    display.innerHTML = "";

    if(!availability || Object.keys(availability).length === 0){
        display.innerHTML = "<p>No availability set yet.</p>";
        return;
    }

    for(const date in availability){
        const slot = availability[date];

        const formattedDate = new Date(date).toLocaleDateString('default', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const card = document.createElement("article");
        card.className = "availability-card";
        card.innerHTML = `
            <section class="card-info">
                <p class="card-date">${formattedDate}</p>
                <p class="card-time">${slot.startTime} - ${slot.endTime}</p>
            </section>
            <button class="remove-btn" data-date="${date}">Remove</button>
        `;

        display.appendChild(card);
    }

    // Add remove button listeners
    document.querySelectorAll(".remove-btn").forEach(function(btn){
        btn.addEventListener("click", async function(){
            const dateToRemove = this.getAttribute("data-date");
            await removeAvailabilityFromBackend(dateToRemove);
        });
    });
}

//Remove from backend
async function removeAvailabilityFromBackend(date) {
    // const staffCode = "STF-330AFB";
    // const staffCode="J96HrT5YN3VOAAzNGqEhpxj4vUx2";
    const user = firebase.auth().currentUser;
    const staffCode = user ? user.uid : "J96HrT5YN3VOAAzNGqEhpxj4vUx2";
    // later: localStorage.getItem("staffCode");

    try {
        const response = await fetch("/api/staff/availability/remove", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ staffCode, date })
        });

        const data = await response.json();

        if(response.ok){
            showToast("Availability removed.", "info");
            LoadAvailability();
        } else {
            showToast("Error: " + data.error, "error");
        }
    } catch(error) {
        console.error("Error removing:", error);
    }
}

//DOMContentLoaded
document.addEventListener("DOMContentLoaded", function(){
    renderCalendar();
    // LoadAvailability();
    firebase.auth().onAuthStateChanged( async function(user) {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        try {
            const idToken = await user.getIdToken();
            currentIdToken = idToken;
            currentStaffId = user.uid;
            const response = await fetch(`/api/user/login/${user.uid}?email=${encodeURIComponent(user.email || "")}`, {
                headers: { "Authorization": `Bearer ${idToken}` }
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}`);
            const result = await response.json();

            if (!result.exists || !result.profile || result.profile.role !== "staff") {
                console.warn("Unauthorized or missing staff profile");
                window.location.href = "dashboard.html";
                return;
            }

            const data = result.profile;
            const clinicInfo = document.getElementById("clinic-info-text");
            if (clinicInfo) {
                clinicInfo.innerHTML = `
                    <span class="clinic-label">Clinic:</span>
                    ${data.clinicName || "N/A"}<br>
                `;
            }

        } catch (error) {
            console.error("Staff Dashboard: Error loading data:", error);
        }

        LoadAvailability();
    });
    // const clinicName = localStorage.getItem("clinicName");
    // const clinicAddress = localStorage.getItem("clinicAddress");

    // if(clinicName){
    //     document.getElementById("clinic-name").textContent = clinicName;
    // }
    // if(clinicAddress){
    //     document.getElementById("clinic-address").textContent = clinicAddress;
    // }

    const Button_addAvailability = document.getElementById("Add_Availability");
    if(Button_addAvailability){
        Button_addAvailability.addEventListener("click", async function(){
            const StartTime = document.getElementById("Startime").value;
            const EndTime = document.getElementById("Endtime").value;
            const Available_bool = document.getElementById("available-check");
            const Checked_value = Available_bool.checked ? "true" : "false";

            if(selectedDates.length === 0){
                showToast("Please select at least one date on the calendar.", "error");
                return;
            }
            if(StartTime >= EndTime){
                showToast("End time must be after start time.", "error");
                return;
            }

            await saveAvailabilityToBackend(StartTime, EndTime, Checked_value);
        });
    }
});