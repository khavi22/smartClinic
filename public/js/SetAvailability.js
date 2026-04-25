import { db } from './firebase_setAvailability.js';
import {
    collection,
    addDoc,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const today = new Date();
let currentViewMonth = today.getMonth();
let currentViewYear = today.getFullYear();
let selectedDate = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

// Your own variables
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

document.addEventListener("DOMContentLoaded", function(){
    renderCalendar();


    const Button_addAvailability=document.getElementById("Add_Availability");
           if(Button_addAvailability){
              Button_addAvailability.addEventListener("click",async function(){
                const StartTime = document.getElementById("Startime").value;
                const EndTime = document.getElementById("Endtime").value;
                const Available_bool=document.getElementById("available-check");
                let Checked_value;
                if(Available_bool.checked){
                    Checked_value="true";
                }
                else if (!Available_bool.checked){
                    Checked_value="false";
                }

                if(selectedDate.length === 0){
                alert("Please select at least one date");
                    return;
                }

                if(StartTime >=EndTime){
                    alert("End time must be after start time");
                    return;
                }
                try{
                    for(const date  of selectedDates){
                        await addDoc(collection(db,"staffAvailability_times"), {
                            Available:Checked_value,
                            date: date,
                            startTime:StartTime,
                            endTime:EndTime,
                        });
                    }
                    selectedDates = [];
                    renderCalendar();
                } catch(error) {
                    console.error("Error saving availability:", error);
                    alert("Failed to save availability");
                }
            })
           }
          
});

