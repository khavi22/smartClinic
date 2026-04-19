// adminDashboard.js
// Auth + nav is handled by dashboard.js (already loaded above)
// This file handles operating hours logic only

// ── TOGGLE: disable time fields when day is closed ──────────
const days = ['mon','tue','wed','thu','fri','sat','sun'];

days.forEach(day => {
    const checkbox = document.getElementById(`${day}-open`);
    const fields   = document.getElementById(`${day}-fields`);
    const row      = checkbox.closest('.day-row');

    // Set initial state
    toggleDay(checkbox, fields, row);

    checkbox.addEventListener('change', () => {
        toggleDay(checkbox, fields, row);
        updateStats();
    });
});

function toggleDay(checkbox, fields, row) {
    if (checkbox.checked) {
        fields.disabled = false;
        fields.style.opacity = '1';
        row.classList.remove('is-closed');
    } else {
        fields.disabled = true;
        fields.style.opacity = '0.3';
        row.classList.add('is-closed');
    }
}

// ── STATS: count open days & today's status ─────────────────
function updateStats() {
    const openCount = days.filter(d =>
        document.getElementById(`${d}-open`).checked
    ).length;

    document.getElementById('openDaysCount').textContent = `${openCount} / 7`;

    // Check if clinic is open right now based on today's hours
    const dayNames = ['sun','mon','tue','wed','thu','fri','sat'];
    const today    = dayNames[new Date().getDay()];
    const todayBox = document.getElementById(`${today}-open`);
    const statusEl = document.getElementById('clinicStatus');

    if (!todayBox.checked) {
        statusEl.textContent  = 'Closed today';
        statusEl.style.color  = '#ef4444';
        return;
    }

    const now       = new Date();
    const startVal  = document.getElementById(`${today}-start`).value;
    const endVal    = document.getElementById(`${today}-end`).value;

    if (startVal && endVal) {
        const [sh, sm] = startVal.split(':').map(Number);
        const [eh, em] = endVal.split(':').map(Number);
        const open     = new Date(); open.setHours(sh, sm, 0);
        const close    = new Date(); close.setHours(eh, em, 0);

        if (now >= open && now <= close) {
            statusEl.textContent = 'Open now';
            statusEl.style.color = '#10b981';
        } else if (now < open) {
            statusEl.textContent = `Opens at ${startVal}`;
            statusEl.style.color = '#f59e0b';
        } else {
            statusEl.textContent = 'Closed for today';
            statusEl.style.color = '#ef4444';
        }
    }
}

updateStats();

// ── FORM SAVE (placeholder — wire to Firestore when ready) ──
const hoursForm   = document.getElementById('hoursForm');
const saveStatus  = document.getElementById('hoursSaveStatus');
const saveBtn     = document.getElementById('hoursSaveBtn');

hoursForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveStatus.textContent = '';
    saveStatus.className   = 'save-status';

    // Build hours object from form
    const hoursData = {};
    days.forEach(day => {
        const isOpen = document.getElementById(`${day}-open`).checked;
        hoursData[day] = {
            open:  isOpen,
            start: document.getElementById(`${day}-start`).value,
            end:   document.getElementById(`${day}-end`).value,
        };
    });

    // TODO: replace with your Firestore save logic
    // e.g. await db.collection('clinics').doc(clinicId).update({ hours: hoursData });
    console.log('Hours to save:', hoursData);

    // Simulate save for now
    await new Promise(r => setTimeout(r, 600));

    saveStatus.textContent = '✓ Hours saved successfully';
    saveBtn.disabled = false;
    updateStats();
});
