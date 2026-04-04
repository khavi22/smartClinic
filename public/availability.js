/**
 * availability.js
 * 
 * This file handles the dynamic rendering of the calendar and time slots.
 * It is designed to be easily integrated with a backend API.
 */

// ==========================================
// 1. DUMMY DATA (Replace this with API calls)
// ==========================================

/**
 * AVAILABILITY_DATA:
 * A mock database of available slots. 
 * In a real app, you would fetch this from your server based on the selected hospital and date.
 */
const AVAILABILITY_DATA = {
    "2026-04-05": [
        { id: 1, time: "08:00 - 09:00", total: 10, taken: 5, status: "available" },
        { id: 2, time: "09:00 - 10:00", total: 10, taken: 9, status: "limited" },
        { id: 3, time: "10:00 - 11:00", total: 10, taken: 2, status: "available" },
        { id: 4, time: "11:00 - 12:00", total: 10, taken: 0, status: "available" },
        { id: 5, time: "12:00 - 13:00", total: 10, taken: 0, status: "available" },
        { id: 6, time: "13:00 - 14:00", total: 10, taken: 3, status: "available" },
        { id: 7, time: "14:00 - 15:00", total: 10, taken: 8, status: "limited" },
        { id: 8, time: "15:00 - 16:00", total: 10, taken: 9, status: "limited" },
        { id: 9, time: "16:00 - 17:00", total: 10, taken: 9, status: "limited" }
    ],
    "2026-04-06": [
        { id: 10, time: "09:00 - 10:00", total: 10, taken: 5, status: "available" },
        { id: 11, time: "14:00 - 15:00", total: 10, taken: 2, status: "available" }
    ]
};

/**
 * BOOKING_POLICY:
 * The rules displayed in the side panel.
 */
const BOOKING_POLICY = [
    "Fixed hourly blocks",
    "Max 10 patients per hour",
    "Please arrive 15 mins early",
    "Cancellations require 24h notice"
];

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================
let selectedDate = "2026-04-05";
let selectedSlotId = null;

// ==========================================
// 3. UI RENDERING FUNCTIONS
// ==========================================

/**
 * Renders the calendar for the selected month
 */
function renderCalendar() {
    const container = document.getElementById('calendarContainer');
    const date = new Date(2026, 3); // April 2026 (0-indexed)
    const monthName = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();

    let html = `
        <div class="cal-header">
            <span>${monthName} ${year}</span>
            <div class="cal-nav">
                <span style="cursor:pointer; margin-right:10px;">&lt;</span>
                <span style="cursor:pointer;">&gt;</span>
            </div>
        </div>
        <div class="cal-grid">
            <div class="cal-day-label">Su</div>
            <div class="cal-day-label">Mo</div>
            <div class="cal-day-label">Tu</div>
            <div class="cal-day-label">We</div>
            <div class="cal-day-label">Th</div>
            <div class="cal-day-label">Fr</div>
            <div class="cal-day-label">Sa</div>
    `;

    // Add empty spaces for the first week
    for (let i = 0; i < 3; i++) html += '<div class="cal-day empty"></div>';

    // Add days (Simulating April 2026)
    for (let day = 1; day <= 30; day++) {
        const dateStr = `2026-04-${day.toString().padStart(2, '0')}`;
        const isSelected = dateStr === selectedDate;
        const isToday = day === 5; // Simulating today is Apr 5

        html += `
            <div class="cal-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" 
                 onclick="handleDateSelection('${dateStr}')">
                ${day}
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
}

/**
 * Renders the slot selection grid
 */
function renderSlots() {
    const grid = document.getElementById('slotsGrid');
    const dateLabel = document.getElementById('selectedDateDisplay');
    const slots = AVAILABILITY_DATA[selectedDate] || [];

    // Update the date label at the top
    const displayDate = new Date(selectedDate).toLocaleDateString('default', { 
        weekday: 'long', month: 'short', day: 'numeric' 
    });
    dateLabel.textContent = displayDate;

    if (slots.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; color: var(--text-muted); text-align: center; padding: 40px;">No slots available for this date.</p>';
        return;
    }

    grid.innerHTML = slots.map(slot => `
        <div class="slot-card ${selectedSlotId === slot.id ? 'selected' : ''}" 
             onclick="handleSlotSelection(${slot.id})">
            <div class="slot-top">
                <span class="slot-time">${slot.time}</span>
                <span class="slot-badge ${slot.status}">${slot.status}</span>
            </div>
            <div class="slot-capacity">
                ${slot.total - slot.taken} / ${slot.total} available
            </div>
        </div>
    `).join('');
}

/**
 * Renders the booking policy list
 */
function renderPolicy() {
    const list = document.getElementById('policyList');
    list.innerHTML = BOOKING_POLICY.map(item => `<li>${item}</li>`).join('');
}

// ==========================================
// 4. EVENT HANDLERS
// ==========================================

function handleDateSelection(dateStr) {
    selectedDate = dateStr;
    selectedSlotId = null; // Clear selection when date changes
    renderCalendar();
    renderSlots();
    updateConfirmButton();
}

function handleSlotSelection(slotId) {
    selectedSlotId = slotId;
    renderSlots();
    updateConfirmButton();
}

function updateConfirmButton() {
    const btn = document.getElementById('confirmBookingBtn');
    if (selectedSlotId) {
        btn.classList.add('active');
        btn.disabled = false;
    } else {
        btn.classList.remove('active');
        btn.disabled = true;
    }
}

// ==========================================
// 5. INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    renderCalendar();
    renderSlots();
    renderPolicy();

    document.getElementById('confirmBookingBtn').addEventListener('click', () => {
        if (selectedSlotId) {
            alert(`Booking confirmed for ${selectedDate}!`);
            // Here you would redirect or send data to server
        }
    });
});
