const today = new Date();
let currentViewMonth = today.getMonth();
let currentViewYear = today.getFullYear();
let selectedDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
let selectedDates = [];

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
    console.log("Selected dates:", selectedDates);
};

window.changeMonth = function(delta) {
    currentViewMonth += delta;
    if (currentViewMonth > 11) { currentViewMonth = 0; currentViewYear++; }
    else if (currentViewMonth < 0) { currentViewMonth = 11; currentViewYear--; }
    renderCalendar();
};

//save to firestore
async function saveAvailabilityToBackend(startTime, endTime, checkedValue) {
    //const staffCode = "STF-330AFB";
    // later: localStorage.getItem("staffCode");

    const response = await fetch("/api/staff/availability/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            dates: selectedDates,   
            startTime: startTime,    
            endTime: endTime,        
            available: checkedValue 
})
    });

    const data = await response.json();

    if(response.ok){
        alert("Availability saved successfully!");
        selectedDates = [];
        renderCalendar();
        LoadAvailability();
    } else {
        alert("Error: " + data.error);
    }
}

// get data from firestore
async function LoadAvailability() {
    const staffCode = "STF-330AFB";
    // later: localStorage.getItem("staffCode");

    try {
        const response = await fetch(`http://localhost:3000/api/staff/availability/${staffCode}`);
        const data = await response.json();
        const availability = data.availability;
        displayAvailability(availability);
    } catch(error) {
        console.error("Error loading availability:", error);
    }
}

//Display availability cards
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
    const staffCode = "STF-330AFB";
    // later: localStorage.getItem("staffCode");

    try {
        const response = await fetch("http://localhost:3000/api/staff/availability/remove", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ staffCode, date })
        });

        const data = await response.json();

        if(response.ok){
            LoadAvailability();
        } else {
            alert("Error: " + data.error);
        }
    } catch(error) {
        console.error("Error removing:", error);
    }
}

//DOMContentLoaded
document.addEventListener("DOMContentLoaded", function(){
    renderCalendar();
    LoadAvailability();

    const Button_addAvailability = document.getElementById("Add_Availability");
    if(Button_addAvailability){
        Button_addAvailability.addEventListener("click", async function(){
            const StartTime = document.getElementById("Startime").value;
            const EndTime = document.getElementById("Endtime").value;
            const Available_bool = document.getElementById("available-check");
            const Checked_value = Available_bool.checked ? "true" : "false";

            if(selectedDates.length === 0){
                alert("Please select at least one date");
                return;
            }

            if(StartTime >= EndTime){
                alert("End time must be after start time");
                return;
            }

            await saveAvailabilityToBackend(StartTime, EndTime, Checked_value);
        });
    }
});