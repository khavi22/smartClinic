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
            window.location.href = "index.html";
            return;
        }

        const data = result.profile;
        currentClinicId = data.clinicId;
        window.authToken = idToken;
        if (currentClinicId) {
            await loadClinicHours(currentClinicId);
            await loadPendingStaff(currentClinicId);
            await loadActiveStaff(currentClinicId);
            await loadClinicProfile(currentClinicId);
            await loadSlotCapacity(currentClinicId); 
        }

    } catch (error) {
        console.error("Admin Dashboard: Error loading profile:", error);
        window.location.href = "dashboard.html";
    }
});

// ── TAB SWITCHING ───────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');

        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
    });
});


async function loadClinicHours(clinicId) {
    const doc = await firebase.firestore().collection("clinics").doc(clinicId).get();
    if (doc.exists) {
        const data = doc.data();
        const hours = data.operatingHours;

        //show clinic name in header
        const clinicNameText = document.getElementById('clinicNameText');
        const clinicNameDisplay = document.getElementById('clinicNameDisplay');
        if (clinicNameText && data.clinicName) {
            clinicNameText.textContent = data.clinicName;
            clinicNameDisplay.hidden = false;
        }

        if (hours) {
            Object.keys(hours).forEach(day => {
                const dayData = hours[day];
                const checkbox = document.getElementById(`${day.substring(0, 3)}-open`);
                const startInput = document.getElementById(`${day.substring(0, 3)}-start`);
                const endInput = document.getElementById(`${day.substring(0, 3)}-end`);

                if (checkbox) checkbox.checked = dayData.isOpen;
                if (startInput) startInput.value = dayData.open || "09:00";
                if (endInput) endInput.value = dayData.close || "17:00";

                toggleDay(checkbox, document.getElementById(`${day.substring(0, 3)}-fields`), checkbox.closest('.day-row'));
            });
        }
    }
}

// ── TOGGLE: disable time fields when day is closed ──────────
const daysShort = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

daysShort.forEach(day => {
    const checkbox = document.getElementById(`${day}-open`);
    const fields = document.getElementById(`${day}-fields`);
    const row = checkbox.closest('.day-row');

    if (checkbox) {
        checkbox.addEventListener('change', () => {
            toggleDay(checkbox, fields, row);
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

// ── FORM SAVE ───────────────────────────────────────────────
const hoursForm = document.getElementById('hoursForm');
const saveStatus = document.getElementById('hoursSaveStatus');
const saveBtn = document.getElementById('hoursSaveBtn');

if (hoursForm) {
    hoursForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentClinicId) return;

        saveBtn.disabled = true;
        saveStatus.textContent = 'Saving...';
        saveStatus.className = 'save-status';

        // Build hours object from form
        const hoursData = {};
        const fullDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

        fullDays.forEach(day => {
            const short = day.substring(0, 3);
            const isOpen = document.getElementById(`${short}-open`).checked;
            hoursData[day] = {
                isOpen: isOpen,
                open: document.getElementById(`${short}-start`).value,
                close: document.getElementById(`${short}-end`).value,
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

            console.log('Update hours response status:', response.status);
            const responseData = await response.json();
            console.log('Update hours response:', responseData);

            if (response.ok) {
                saveStatus.textContent = '✓ Hours saved successfully';
                saveStatus.style.color = 'var(--success-green)';
            } else {
                throw new Error(responseData.message || "Failed to save");
            }
        } catch (error) {
            console.error('Save error:', error);
            saveStatus.textContent = '× Error saving hours';
            saveStatus.style.color = '#ef4444';
        } finally {
            saveBtn.disabled = false;
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
            showToast(`Staff member ${status} successfully.`, "success");
            await loadPendingStaff(currentClinicId);
            await loadActiveStaff(currentClinicId);
        } else {
            const result = await response.json();
            showToast('Error: ' + (result.message || 'Failed to process approval'), "error");
        }
    } catch (error) {
        console.error('Approval exception:', error);
        showToast('An unexpected network error occurred.', "error");
    }
};

async function loadActiveStaff(clinicId) {
    const container = document.getElementById('activeStaffList');
    if (!container) return;

    try {
        const idToken = await firebase.auth().currentUser.getIdToken();
        const response = await fetch(`/api/admin/active-staff?clinicId=${clinicId}`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });

        const result = await response.json();
        if (response.ok && result.success) {
            renderActiveStaff(result.staff);
        } else {
            throw new Error(result.message || "Failed to load staff members");
        }
    } catch (error) {
        console.error('Error loading active staff:', error);
        const container = document.getElementById('activeStaffList');
        if (container) {
            container.innerHTML = '<p class="text-muted" style="font-size: 0.88rem; padding: 12px 0; color: #ef4444;">Error loading staff members. Please try again.</p>';
        }
    }
}

function renderActiveStaff(staff) {
    const container = document.getElementById('activeStaffList');
    if (!container) return;

    if (!staff || staff.length === 0) {
        container.innerHTML = '<p class="text-muted" style="font-size: 0.88rem; padding: 12px 0;">No active staff members</p>';
        return;
    }

    container.innerHTML = staff.map(s => `
        <div class="active-staff-item">
            <div class="staff-avatar-mini">${s.fullName ? s.fullName[0].toUpperCase() : 'S'}</div>
            <div class="staff-main-info">
                <div class="staff-name">${s.fullName}</div>
                <div class="staff-email">${s.email}</div>
            </div>
            <button onclick="fireStaff('${s.uid}', '${s.fullName}')" class="btn-fire">
                <i class='bx bx-user-x'></i>
                Fire
            </button>
        </div>
    `).join('');
}

window.fireStaff = async (staffUid, name) => {
    if (!confirm(`Are you sure you want to remove ${name} from your staff? They will lose all access to the clinic.`)) return;

    try {
        const idToken = await firebase.auth().currentUser.getIdToken();
        const response = await fetch('/api/admin/remove-staff', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ staffUid, clinicId: currentClinicId })
        });

        if (response.ok) {
            showToast("Staff member removed successfully.", "success");
            await loadActiveStaff(currentClinicId);
        } else {
            const result = await response.json();
            showToast('Error: ' + (result.message || 'Failed to remove staff'), "error");
        }
    } catch (error) {
        console.error('Fire staff error:', error);
        showToast('An unexpected network error occurred.', "error");
    }
};

// ── CLINIC PROFILE: load ────────────────────────────────────────────────────
async function loadClinicProfile(clinicId) {
    const doc = await firebase.firestore().collection("clinics").doc(clinicId).get();
    if (!doc.exists) return;
    const data = doc.data();

    // Facility type
    if (data.facilityType) {
        const radio = document.querySelector(`input[name="facilityType"][value="${data.facilityType}"]`);
        if (radio) radio.checked = true;
    }

    // Province
    if (data.province) {
        const sel = document.getElementById("clinicProvince");
        if (sel) sel.value = data.province;
    }

    // District & Region
    if (data.district) {
        const el = document.getElementById("clinicDistrict");
        if (el) el.value = data.district;
    }
    if (data.region) {
        const el = document.getElementById("clinicRegion");
        if (el) el.value = data.region;
    }

    // Services
    if (data.services && Array.isArray(data.services)) {
        data.services.forEach(svc => {
            const cb = document.querySelector(`#profileForm input[name="services"][value="${svc}"]`);
            if (cb) cb.checked = true;
        });
    }
}

// ── CLINIC PROFILE: save ─────────────────────────────────────────────────────
document.getElementById("saveProfileBtn").addEventListener("click", async () => {
    if (!currentClinicId) {
        showToast("No clinic associated with your account.", "error");
        return;
    }

    const btn = document.getElementById("saveProfileBtn");
    const status = document.getElementById("profileSaveStatus");

    const facilityTypeEl = document.querySelector('input[name="facilityType"]:checked');
    const facilityType = facilityTypeEl ? facilityTypeEl.value : "";
    const services = [...document.querySelectorAll('#profileForm input[name="services"]:checked')]
        .map(cb => cb.value);

    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Saving…`;
    status.textContent = "";
    status.className = "save-status";

    try {
        // Exclude province, district, region from the update payload to prevent updates
        await firebase.firestore().collection("clinics").doc(currentClinicId).set({
            facilityType,
            services
        }, { merge: true });

        status.textContent = "✓ Profile saved successfully";
        status.className = "save-status";
        btn.innerHTML = `<i class='bx bx-save'></i> Save Profile`;
        btn.disabled = false;

        setTimeout(() => { status.textContent = ""; }, 4000);
        setClinicFormEditable(false);
    } catch (err) {
        console.error("Save profile error:", err);
        status.textContent = "Failed to save. Please try again.";
        status.className = "save-status error";
        btn.innerHTML = `<i class='bx bx-save'></i> Save Profile`;
        btn.disabled = false;
    }
});


const profileForm = document.getElementById("profileForm");
const toggleClinicEditBtn = document.getElementById("toggleClinicEditBtn");

let clinicEditingEnabled = false;

function setClinicFormEditable(enabled) {

    clinicEditingEnabled = enabled;

    const fields = profileForm.querySelectorAll(
        "input, select, textarea"
    );

    fields.forEach(field => {

        // keep buttons active
        if (
            field.type === "button" ||
            field.type === "submit"
        ) return;

        field.disabled = !enabled;
    });

    // Save button
    const saveBtn = document.getElementById("saveClinicProfileBtn");

    if (saveBtn) {
        saveBtn.hidden = !enabled;
    }

    // Toggle button text
    toggleClinicEditBtn.textContent =
        enabled ? "Cancel Editing" : "Enable Editing";

    // Styling state
    profileForm.classList.toggle(
        "profile-form-locked",
        !enabled
    );
}

// Default = locked
setClinicFormEditable(false);

toggleClinicEditBtn.addEventListener("click", () => {

    setClinicFormEditable(!clinicEditingEnabled);
});

// ── SLOT CAPACITY ────────────────────────────────────────────
const slotCapacitySlider = document.getElementById("slotCapacitySlider");
const capacityValueDisplay = document.getElementById("capacityValue");
const capacitySaveBtn = document.getElementById("capacitySaveBtn");
const capacitySaveStatus = document.getElementById("capacitySaveStatus");

if (slotCapacitySlider) {
    slotCapacitySlider.addEventListener("input", () => {
        capacityValueDisplay.textContent = slotCapacitySlider.value;
        slotCapacitySlider.setAttribute("aria-valuenow", slotCapacitySlider.value);
    });
}

async function loadSlotCapacity(clinicId) {
    try {
        const doc = await firebase.firestore().collection("clinics").doc(clinicId).get();
        if (!doc.exists) return;

        const capacity = doc.data().slotCapacity;
        if (capacity && slotCapacitySlider) {
            slotCapacitySlider.value = capacity;
            capacityValueDisplay.textContent = capacity;
            slotCapacitySlider.setAttribute("aria-valuenow", capacity);
        }
    } catch (error) {
        console.error("Error loading slot capacity:", error);
    }
}

if (capacitySaveBtn) {
    capacitySaveBtn.addEventListener("click", async () => {
        if (!currentClinicId) {
            showToast("No clinic associated with your account.", "error");
            return;
        }

        capacitySaveBtn.disabled = true;
        capacitySaveBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Saving…`;
        capacitySaveStatus.textContent = "";

        try {
            const idToken = await firebase.auth().currentUser.getIdToken();
            const response = await fetch(`/api/clinics/${currentClinicId}/slot-capacity`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({ slotCapacity: Number(slotCapacitySlider.value) })
            });

            const result = await response.json();

            if (response.ok) {
                capacitySaveStatus.textContent = "✓ Capacity saved successfully";
                capacitySaveStatus.style.color = "var(--success-green)";
                showToast("Slot capacity updated successfully.", "success");
            } else {
                throw new Error(result.error || "Failed to save capacity");
            }
        } catch (error) {
            console.error("Error saving slot capacity:", error);
            capacitySaveStatus.textContent = "× Error saving capacity";
            capacitySaveStatus.style.color = "#ef4444";
            showToast(error.message || "Failed to save slot capacity.", "error");
        } finally {
            capacitySaveBtn.disabled = false;
            capacitySaveBtn.innerHTML = `<i class='bx bx-save'></i> <span>Save Capacity</span>`;
            setTimeout(() => { capacitySaveStatus.textContent = ""; }, 4000);
        }
    });
}
