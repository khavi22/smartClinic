let cachedSlots = [];

const __now = new Date();
let today = __now;
let currentViewMonth = today.getMonth();
let currentViewYear = today.getFullYear();
let selectedDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
let selectedSlotId = null;



async function fetchTodayDate() {

    return new Promise(resolve => {
        setTimeout(() => {
            resolve(new Date()); // today's date
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
            <span class="cal-day-label">Su</span>
            <span class="cal-day-label">Mo</span>
            <span class="cal-day-label">Tu</span>
            <span class="cal-day-label">We</span>
            <span class="cal-day-label">Th</span>
            <span class="cal-day-label">Fr</span>
            <span class="cal-day-label">Sa</span>
    `;

    // show current month slots
    const firstDayOfMonth = new Date(currentViewYear, currentViewMonth, 1).getDay();
    const daysInMonth = new Date(currentViewYear, currentViewMonth + 1, 0).getDate();


    for (let i = 0; i < firstDayOfMonth; i++) {
        html += '<span class="cal-day empty"></span>';
    }

    //  All days from 1st to end of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(currentViewYear, currentViewMonth, day);
        const dateStr = `${currentViewYear}-${(currentViewMonth + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        const isSelected = dateStr === selectedDate;
        const isToday = dateObj.toDateString() === today.toDateString();
        const isPast = dateObj < today && !isToday; // disable strictly past dates
        const isAvailable = !isPast;

        html += `
            <button type="button" class="cal-day ${isSelected ? 'selected' : ''} ${isAvailable ? 'available' : ''} ${isToday ? 'today' : ''} ${isPast ? 'disabled' : ''}" 
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

// display selection slots
function renderSlots() {
    const grid = document.getElementById('slotsGrid');
    const dateLabel = document.getElementById('selectedDateDisplay');
    if (!grid || !dateLabel) return;

    const allSlots = cachedSlots || [];

    // Grouping by morning ,afternoon and evening
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

    // Check if the selected date is today or in the past
    const realNow = new Date();
    const todayDateObj = new Date(realNow.getFullYear(), realNow.getMonth(), realNow.getDate());

    const selectedDateParts = selectedDate.split('-');
    const selYear = parseInt(selectedDateParts[0], 10);
    const selMonth = parseInt(selectedDateParts[1], 10) - 1;
    const selDay = parseInt(selectedDateParts[2], 10);
    const selDateObj = new Date(selYear, selMonth, selDay);

    // Evaluate historic status
    const isPastDate = selDateObj < todayDateObj;
    const isToday = selDateObj.getTime() === todayDateObj.getTime();
    const currentHour = realNow.getHours();

    for (const [title, slots] of Object.entries(groups)) {
        if (slots.length === 0) continue;

        const isGroupUnavailable = slots.every(slot => {
            const isPast = isPastDate || (isToday && slot.id <= currentHour);
            return isPast || slot.status === 'full';
        });

        gridHtml += `
            <details class="slot-group-details" ${isGroupUnavailable ? '' : 'open'}>
                <summary class="slot-group-header">
                    <span>${title}</span>
                    <mark class="group-status-badge ${isGroupUnavailable ? 'full' : 'available'}">${isGroupUnavailable ? 'Fully Booked' : 'Available Spaces'}</mark>
                </summary>
                <menu class="slot-group-grid">
                    ${slots.map(slot => {
            const isPast = isPastDate || (isToday && slot.id <= currentHour);
            const displayStatus = isPast ? 'past' : slot.status;
            const cssClass = isPast || slot.status === 'full' ? 'full' : '';
            let capacityLabel = "";

            if (isPast) {
                capacityLabel = "Time Passed";
            } else if (slot.total - slot.taken > 0) {
                const remaining = slot.total - slot.taken;
                capacityLabel = `${remaining} spot${remaining === 1 ? '' : 's'} available`;
            } else {
                capacityLabel = "Currently Unavailable";
            }

            return `
                        <button type="button" class="slot-card ${selectedSlotId === slot.id ? 'selected' : ''} ${cssClass}" 
                             onclick="${isPast ? '' : `window.handleSlotSelection(${slot.id})`}">
                            <hgroup class="slot-top">
                                <time class="slot-time">${slot.time}</time>
                                <mark class="slot-badge ${displayStatus}">${displayStatus}</mark>
                            </hgroup>
                            <output class="slot-capacity">${capacityLabel}</output>
                        </button>
                        `;
        }).join('')}
                </menu>
            </details>
        `;
    }

    if (!gridHtml) {
        grid.innerHTML = '<article class="no-slots">No slots available for this date.</article>';
    } else {
        grid.innerHTML = gridHtml;
    }
}



window.handleDateSelection = async function (dateStr) {
    selectedDate = dateStr;
    selectedSlotId = null;

    // Get selected clinic ID from the URL to properly filter Firebase
    const urlParams = new URLSearchParams(window.location.search);
    const clinicId = urlParams.get('id') || "default_clinic";

    try {
        const grid = document.getElementById('slotsGrid');
        if (grid) grid.innerHTML = '<article class="no-slots">Loading...</article>';
        const urlReq = `/api/availability?date=${dateStr}&clinicId=${encodeURIComponent(clinicId)}`;
        const res = await fetch(urlReq);

        if (!res.ok) throw new Error("Server returned " + res.status);

        const data = await res.json();
        cachedSlots = data.slots || [];
    } catch (error) {
        console.error("Failed to fetch slots", error);
        cachedSlots = [];
        const grid = document.getElementById('slotsGrid');
        if (grid) {
            grid.innerHTML = `<output class="no-slots" style="color:red;">Error loading slots: ${error.message}. Is the server running?</output>`;
        }
        return;
    }

    renderCalendar();
    renderSlots();
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
    const slot = cachedSlots.find(s => s.id === slotId);
    if (!slot || slot.status === 'full') {
        return;
    }
    selectedSlotId = slotId;
    renderSlots();

    const dialog = document.getElementById('bookingModal');
    const details = document.getElementById('dialogBookingDetails');
    const displayDate = new Date(selectedDate).toLocaleDateString('default', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    details.innerHTML = `Confirm your appointment for <br><time><strong>${displayDate}</strong> at <strong>${slot.time}</strong></time>?`;
    dialog.showModal();
};

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

        const addrNode = document.getElementById('hospitalAddress');
        addrNode.innerHTML = `<figure class="icon-box addr-icon" style="margin: 0;"><svg class="icons" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></figure> <span>${address}</span>`;
    }
    if (type && document.getElementById('hospitalType')) {
        document.getElementById('hospitalType').textContent = type;
    }
}


document.addEventListener('DOMContentLoaded', async () => {

    const dialog = document.getElementById('bookingModal');
    const cancelBtn = document.getElementById('cancelBookingBtn');
    const confirmBtn = document.getElementById('modalConfirmBtn');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            dialog.close();
            selectedSlotId = null;
            renderSlots();
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (selectedSlotId !== null) {
                const slot = cachedSlots.find(s => s.id === selectedSlotId);
                const urlParams = new URLSearchParams(window.location.search);
                const clinicId = urlParams.get('id') || "default_clinic";
                const oldBookingId = urlParams.get('oldBookingId');
                const clinicName = document.getElementById('hospitalName')?.textContent || "Unknown Clinic";
                const clinicAddress = document.getElementById('hospitalAddressText')?.textContent || 
                                     document.getElementById('hospitalAddress')?.querySelector('span')?.textContent || 
                                     "Address not provided";

                confirmBtn.disabled = true;
                cancelBtn.disabled = true;

                const originalText = confirmBtn.textContent;
                confirmBtn.innerHTML = '<span class="spinner"></span> Processing...';
                confirmBtn.classList.add('loading');
                
                try {
                    const patientId = localStorage.getItem("patientId");

                    if (!patientId) {
                        window.location.href = "login.html";
                    }
                    const res = await fetch('/api/bookings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            patientId: patientId,
                            clinicId: clinicId,
                            clinicName: clinicName,
                            clinicAddress: clinicAddress,
                            date: selectedDate,
                            timeSlot: slot.time,
                            oldBookingId: oldBookingId
                        })
                    });

                    const data = await res.json();

                    if (res.ok) {
                        dialog.close();
                        if (oldBookingId) {
                            alert(`Your appointment has been successfully rescheduled to ${selectedDate} at ${slot.time}!`);
                        } else {
                            alert(`Booking successfully confirmed for ${selectedDate} at ${slot.time}!`);
                        }
                        selectedSlotId = null;
                        await window.handleDateSelection(selectedDate);
                        
                        // If rescheduled, redirect back to appointments page after a short delay
                        if (oldBookingId) {
                           setTimeout(() => { window.location.href = 'apointments.html'; }, 1500);
                        }
                    } else {
                        alert(`Booking failed: ${data.error}`);
                    }
                } catch (error) {
                    console.error("Booking err:", error);
                    alert("Error contacting the server.");
                } finally {
                    confirmBtn.disabled = false;
                    cancelBtn.disabled = false;
                    confirmBtn.textContent = originalText;
                    confirmBtn.classList.remove('loading');
                }
            }
        });
    }


    loadHospitalData();


    try {
        today = await fetchTodayDate();
        await window.handleDateSelection(selectedDate);
    } catch (err) {
        console.error("Initial load failed", err);
    }
});

