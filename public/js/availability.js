let cachedSlots = [];

let today = new Date(2026, 3, 5); // demo selected date 
let currentViewMonth = today.getMonth();
let currentViewYear = today.getFullYear();
let selectedDate = "2026-04-05";
let selectedSlotId = null;



/**
 * SIMULATED API CALL: Get current date from server
 */
async function fetchTodayDate() {
    // In a real website use this to get current date return fetch('/api/today').then(res => res.json()); create the fetch function using express
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(new Date(2026, 3, 5)); // Apr 5, 2026
        }, 100);
    });
}

// display a calendar
function renderCalendar() {
    const container = document.getElementById('calendarContainer');
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
            <div class="cal-day-label">Su</div>
            <div class="cal-day-label">Mo</div>
            <div class="cal-day-label">Tu</div>
            <div class="cal-day-label">We</div>
            <div class="cal-day-label">Th</div>
            <div class="cal-day-label">Fr</div>
            <div class="cal-day-label">Sa</div>
    `;

    // 1. Start of the current view month
    const firstDayOfMonth = new Date(currentViewYear, currentViewMonth, 1).getDay();
    const daysInMonth = new Date(currentViewYear, currentViewMonth + 1, 0).getDate();

    // 2. Preceding empty slots
    for (let i = 0; i < firstDayOfMonth; i++) {
        html += '<div class="cal-day empty"></div>';
    }

    // 3. All days from 1st to end of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(currentViewYear, currentViewMonth, day);
        const dateStr = `${currentViewYear}-${(currentViewMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        const isSelected = dateStr === selectedDate;
        const isToday = dateObj.toDateString() === today.toDateString();
        const isPast = dateObj < today && !isToday; // Disable strictly past dates
        const isAvailable = !isPast; // Assume future dates are available for check

        html += `
            <div class="cal-day ${isSelected ? 'selected' : ''} ${isAvailable ? 'available' : ''} ${isToday ? 'today' : ''} ${isPast ? 'disabled' : ''}" 
                 onclick="${isPast ? '' : `window.handleDateSelection('${dateStr}')`}">
                ${day}
            </div>
        `;
    }

    // 4. Trailing empty slots to complete the 7-column grid
    const totalSlotsUsed = firstDayOfMonth + daysInMonth;
    const remainingSlots = (7 - (totalSlotsUsed % 7)) % 7;
    for (let i = 0; i < remainingSlots; i++) {
        html += '<div class="cal-day empty"></div>';
    }

    html += '</section>';
    container.innerHTML = html;
}

// display selection slots
function renderSlots() {
    const grid = document.getElementById('slotsGrid');
    const dateLabel = document.getElementById('selectedDateDisplay');
    if (!grid || !dateLabel) return;

    const allSlots = cachedSlots || [];

    // Grouping Logic
    const groups = {
        "Morning (00:00 - 11:59)": allSlots.filter(s => s.id < 12),
        "Afternoon (12:00 - 17:59)": allSlots.filter(s => s.id >= 12 && s.id < 18),
        "Evening & Night (18:00 - 23:59)": allSlots.filter(s => s.id >= 18)
    };

    const displayDate = new Date(selectedDate).toLocaleDateString('default', {
        weekday: 'long', month: 'short', day: 'numeric'
    });
    dateLabel.textContent = displayDate;

    let gridHtml = '';

    for (const [title, slots] of Object.entries(groups)) {
        if (slots.length === 0) continue;

        gridHtml += `
            <header class="slot-group-header">${title}</header>
            <section class="slot-group-grid">
                ${slots.map(slot => `
                    <section class="slot-card ${selectedSlotId === slot.id ? 'selected' : ''}" 
                         onclick="window.handleSlotSelection(${slot.id})">
                        <header class="slot-top">
                            <span class="slot-time">${slot.time}</span>
                            <section class="slot-badge ${slot.status}">${slot.status}</section>
                        </header>
                        <section class="slot-capacity">
                            ${slot.total - slot.taken} / ${slot.total} available
                        </section>
                    </section>
                `).join('')}
            </section>
        `;
    }

    if (!gridHtml) {
        grid.innerHTML = '<section class="no-slots">No slots available for this date.</section>';
    } else {
        grid.innerHTML = gridHtml;
    }
}



window.handleDateSelection = async function (dateStr) {
    selectedDate = dateStr;
    selectedSlotId = null;

    try {
        const grid = document.getElementById('slotsGrid');
        if (grid) grid.innerHTML = '<section class="no-slots">Loading...</section>';
        
        // Use realistic API delay / fetch
        const res = await fetch(`/api/availability?date=${dateStr}`);
        const data = await res.json();
        cachedSlots = data.slots || [];
    } catch (error) {
        console.error("Failed to fetch slots", error);
        cachedSlots = [];
    }

    renderCalendar();
    renderSlots();
    updateConfirmButton();
};

window.changeMonth = function (delta) {
    currentViewMonth += delta;
    if (currentViewMonth > 11) {
        currentViewMonth = 0;
        currentViewYear++;
    } else if (currentViewMonth < 0) {
        currentViewMonth = 11;
        currentViewYear--;
    }
    renderCalendar();
};

window.handleSlotSelection = function (slotId) {
    selectedSlotId = slotId;
    renderSlots();
    updateConfirmButton();
};

function updateConfirmButton() {
    const btn = document.getElementById('confirmBookingBtn');
    if (btn) {
        if (selectedSlotId !== null) {
            btn.classList.add('active');
            btn.disabled = false;
        } else {
            btn.classList.remove('active');
            btn.disabled = true;
        }
    }
}


// load from URL or local storage
function loadHospitalData() {
    const urlParams = new URLSearchParams(window.location.search);
    
    const name = urlParams.get('name') || localStorage.getItem('selectedHospitalName');
    const address = urlParams.get('address') || localStorage.getItem('selectedHospitalAddress');
    const type = urlParams.get('type') || localStorage.getItem('selectedHospitalType');

    if (name && document.getElementById('hospitalName')) {
        document.getElementById('hospitalName').textContent = name;
    }
    if (address && document.getElementById('hospitalAddressText')) {
        document.getElementById('hospitalAddressText').textContent = address;
    } else if (address && document.getElementById('hospitalAddress')) {
        // Fallback for older DOM structure just in case
        const addrNode = document.getElementById('hospitalAddress');
        addrNode.innerHTML = `<figure class="icon-box addr-icon"><img class="icons" src="/icons/location.svg" alt="Location Icon"></figure> <span>${address}</span>`;
    }
    if (type && document.getElementById('hospitalType')) {
        document.getElementById('hospitalType').textContent = type;
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load context from previous page
    loadHospitalData();

    // 2. Fetch Today's Date
    today = await fetchTodayDate();

    // 3. Initial Render
    await window.handleDateSelection(selectedDate);

    const btn = document.getElementById('confirmBookingBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            if (selectedSlotId !== null) {
                alert(`Booking confirmed for ${selectedDate}!`);
            }
        });
    }
});

