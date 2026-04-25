// adminDashboard.js
// Auth + nav is handled by dashboard.js and authGuard.js
// This file handles operating hours logic and data persistence

let currentClinicId = null;

firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }
    
    try {
        console.log("Admin Dashboard: Fetching profile from server...");
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/user/login/${user.uid}?email=${encodeURIComponent(user.email || "")}`, {
            headers: { "Authorization": `Bearer ${idToken}` }
        });

        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const result = await response.json();

        if (!result.exists || !result.profile || result.profile.role !== "admin") {
            console.warn("Unauthorized or missing admin profile");
            window.location.href = "dashboard.html";
            return;
        }

        const data = result.profile;
        currentClinicId = data.clinicId;
        if (currentClinicId) {
            // Clinic hours search might still hit rules, 
            // but at least we have the clinic ID and profile secure.
            await loadClinicHours(currentClinicId);
        }

    } catch (error) {
        console.error("Admin Dashboard: Error loading profile:", error);
        window.location.href = "dashboard.html";
    }
});


async function loadClinicHours(clinicId) {
    const doc = await firebase.firestore().collection("clinics").doc(clinicId).get();
    if (doc.exists) {
        const data = doc.data();
        const hours = data.operatingHours;
        const statusEl = document.getElementById('clinicStatus');

        //show clinic name in header
        const clinicNameText    = document.getElementById('clinicNameText');
        const clinicNameDisplay = document.getElementById('clinicNameDisplay');
        if (clinicNameText && data.clinicName) {
            clinicNameText.textContent = data.clinicName;
            clinicNameDisplay.hidden   = false;
        }
        
        if (hours) {
            Object.keys(hours).forEach(day => {
                const dayData = hours[day];
                const checkbox = document.getElementById(`${day.substring(0,3)}-open`);
                const startInput = document.getElementById(`${day.substring(0,3)}-start`);
                const endInput = document.getElementById(`${day.substring(0,3)}-end`);
                
                if (checkbox) checkbox.checked = dayData.isOpen;
                if (startInput) startInput.value = dayData.open || "09:00";
                if (endInput) endInput.value = dayData.close || "17:00";
                
                toggleDay(checkbox, document.getElementById(`${day.substring(0,3)}-fields`), checkbox.closest('.day-row'));
            });
        }
        
        if (data.isActive) {
            statusEl.textContent = "Active";
            statusEl.style.color = "var(--success-green)";
        }
        updateStats();
    }
}

// ── TOGGLE: disable time fields when day is closed ──────────
const daysShort = ['mon','tue','wed','thu','fri','sat','sun'];

daysShort.forEach(day => {
    const checkbox = document.getElementById(`${day}-open`);
    const fields   = document.getElementById(`${day}-fields`);
    const row      = checkbox.closest('.day-row');

    if (checkbox) {
        checkbox.addEventListener('change', () => {
            toggleDay(checkbox, fields, row);
            updateStats();
        });
    }
});

function toggleDay(checkbox, fields, row) {
    if (!checkbox || !fields) return;
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
    const openCount = daysShort.filter(d => {
        const el = document.getElementById(`${d}-open`);
        return el && el.checked;
    }).length;

    const openDaysEl = document.getElementById('openDaysCount');
    if (openDaysEl) openDaysEl.textContent = `${openCount} / 7`;
}

// ── FORM SAVE ───────────────────────────────────────────────
const hoursForm   = document.getElementById('hoursForm');
const saveStatus  = document.getElementById('hoursSaveStatus');
const saveBtn     = document.getElementById('hoursSaveBtn');

if (hoursForm) {
    hoursForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentClinicId) return;

        saveBtn.disabled = true;
        saveStatus.textContent = 'Saving...';
        saveStatus.className   = 'save-status';

        // Build hours object from form
        const hoursData = {};
        const fullDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
        
        fullDays.forEach(day => {
            const short = day.substring(0, 3);
            const isOpen = document.getElementById(`${short}-open`).checked;
            hoursData[day] = {
                isOpen: isOpen,
                open:  document.getElementById(`${short}-start`).value,
                close:  document.getElementById(`${short}-end`).value,
            };
        });

        try {
            const idToken = await firebase.auth().currentUser.getIdToken();
            const response = await fetch('/api/clinics/update-hours', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    clinicId: currentClinicId,
                    operatingHours: hoursData
                })
            });

            if (response.ok) {
                saveStatus.textContent = '✓ Hours saved successfully';
                saveStatus.style.color = 'var(--success-green)';
            } else {
                throw new Error("Failed to save");
            }
        } catch (error) {
            console.error('Save error:', error);
            saveStatus.textContent = '× Error saving hours';
            saveStatus.style.color = '#ef4444';
        } finally {
            saveBtn.disabled = false;
            updateStats();
        }
    });
}


