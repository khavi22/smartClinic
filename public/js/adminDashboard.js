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
            await loadPendingStaff(currentClinicId);
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

// ── STAFF MANAGEMENT ──────────────────────────────────────────
const inviteForm = document.getElementById('inviteStaffForm');
const inviteStatus = document.getElementById('inviteStatus');
const inviteBtn = document.getElementById('inviteBtn');
const pendingStaffList = document.getElementById('pendingStaffList');

if (inviteForm) {
    inviteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('inviteEmail').value.trim();
        if (!email || !currentClinicId) return;

        inviteBtn.disabled = true;
        inviteStatus.textContent = 'Sending invitation...';
        inviteStatus.style.color = 'var(--text-muted)';

        try {
            const idToken = await firebase.auth().currentUser.getIdToken();
            const response = await fetch('/api/admin/invite-staff', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ email, clinicId: currentClinicId })
            });

            const result = await response.json();
            if (response.ok) {
                inviteStatus.textContent = '✓ Invitation sent successfully';
                inviteStatus.style.color = 'var(--success-green)';
                inviteForm.reset();
            } else {
                throw new Error(result.message || 'Failed to send invitation');
            }
        } catch (error) {
            console.error('Invite error:', error);
            inviteStatus.textContent = '× ' + error.message;
            inviteStatus.style.color = '#ef4444';
        } finally {
            inviteBtn.disabled = false;
        }
    });
}

async function loadPendingStaff(clinicId) {
    if (!pendingStaffList) return;

    try {
        const idToken = await firebase.auth().currentUser.getIdToken();
        const response = await fetch(`/api/admin/pending-staff?clinicId=${clinicId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            renderPendingStaff(result.staff);
        }
    } catch (error) {
        console.error('Error loading pending staff:', error);
    }
}

function renderPendingStaff(staff) {
    const container = document.getElementById('pendingStaffList');
    if (!container) return;
    
    if (!staff || staff.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size: 0.88rem; padding: 12px 0;">No pending approvals</p>';
        return;
    }

    container.innerHTML = staff.map(s => `
        <div class="staff-item">
            <div class="staff-info">
                <span class="staff-name">${s.fullName}</span>
                <span class="staff-email">${s.email}</span>
            </div>
            <div class="staff-actions">
                <button onclick="processApproval('${s.uid}', 'approved')" class="btn-approve">Approve</button>
                <button onclick="processApproval('${s.uid}', 'rejected')" class="btn-reject">Reject</button>
            </div>
        </div>
    `).join('');
}

window.processApproval = async (staffUid, status) => {
    if (!currentClinicId) return;

    const confirmMsg = status === 'approved' ? 'Approve this staff member?' : 'Reject this staff application?';
    if (!confirm(confirmMsg)) return;

    try {
        const idToken = await firebase.auth().currentUser.getIdToken();
        const response = await fetch('/api/admin/process-staff', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ staffUid, status, clinicId: currentClinicId })
        });

        if (response.ok) {
            await loadPendingStaff(currentClinicId);
        } else {
            const result = await response.json();
            console.error('Approval API error:', result);
            alert('Error: ' + (result.message || 'Failed to process approval'));
        }
    } catch (error) {
        console.error('Approval exception:', error);
        alert('An unexpected network error occurred. Please check your connection and try again.');
    }
};
