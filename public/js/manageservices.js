// manageservices.js

let currentClinicId = null;
let editingServiceId = null;
window.authToken = null;

// Always returns a fresh (non-expired) Firebase ID token.
async function getAuthToken() {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken(/* forceRefresh */ false);
  window.authToken = token;
  return token;
}

firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        const idToken = await user.getIdToken();
        window.authToken = idToken;

        const response = await fetch(`/api/user/login/${user.uid}?email=${encodeURIComponent(user.email || "")}`, {
            headers: { "Authorization": `Bearer ${idToken}` }
        });

        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        const result = await response.json();

        if (!result.exists || !result.profile || result.profile.role !== "admin") {
            window.location.href = "index.html";
            return;
        }

        currentClinicId = result.profile.clinicId;
        if (currentClinicId) {
            await loadClinicProfile(currentClinicId);
            await loadTemplates();
            await loadServices();
        }

    } catch (error) {
        console.error("Manage Services: Error loading profile:", error);
        showToast("Error loading profile", "error");
    }
});

// ── LOAD CLINIC PROFILE (DETAILS + FACILITY TYPE) ──
async function loadClinicProfile(clinicId) {
    try {
        const doc = await firebase.firestore().collection("clinics").doc(clinicId).get();
        if (!doc.exists) return;

        const data = doc.data();

        // Clinic Name Header
        const clinicNameText = document.getElementById('clinicNameText');
        const clinicNameDisplay = document.getElementById('clinicNameDisplay');
        if (clinicNameText && data.clinicName) {
            clinicNameText.textContent = data.clinicName;
            clinicNameDisplay.hidden = false;
        }

        // Location Details (Read-only)
        if (document.getElementById('clinicProvince')) document.getElementById('clinicProvince').value = data.province || '';
        if (document.getElementById('clinicDistrict')) document.getElementById('clinicDistrict').value = data.district || '';
        if (document.getElementById('clinicRegion')) document.getElementById('clinicRegion').value = data.region || '';
        if (document.getElementById('clinicPlaceId')) document.getElementById('clinicPlaceId').value = data.placeId || '';
        if (document.getElementById('clinicAddress')) document.getElementById('clinicAddress').value = data.address || '';

        // Facility Type
        if (data.facilityType) {
            const facilityRadio = document.querySelector(`input[name="facilityType"][value="${data.facilityType}"]`);
            if (facilityRadio) facilityRadio.checked = true;
        }

    } catch (err) {
        console.error("Error loading clinic profile", err);
    }
}

// ── SAVE CLINIC PROFILE (facility type + location) ──
document.getElementById('clinicProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('saveClinicProfileBtn');
    const status = document.getElementById('profileSaveStatus');
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Saving...';
    status.textContent = "";

    try {
        const token = await getAuthToken();

        const payload = {
            facilityType: document.querySelector('input[name="facilityType"]:checked')?.value || "",
            province:     document.getElementById('clinicProvince').value.trim(),
            district:     document.getElementById('clinicDistrict').value.trim(),
            region:       document.getElementById('clinicRegion').value.trim(),
            address:      document.getElementById('clinicAddress').value.trim(),
        };

        const res = await fetch('/api/clinics/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `Server error ${res.status}`);
        }

        status.textContent = "Saved successfully!";
        status.className = "save-status";
        setTimeout(() => { status.textContent = ""; }, 3000);
    } catch (err) {
        console.error("Error saving clinic profile:", err);
        status.textContent = err.message || "Error saving changes";
        status.className = "save-status error";
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = "<i class='bx bx-save'></i> Save Clinic Profile";
    }
});

// ── SERVICES & DURATIONS MANAGEMENT ──

async function loadTemplates() {
  try {
    const res = await fetch("/api/clinics/templates", {
      headers: { "Authorization": `Bearer ${window.authToken}` }
    });
    if (!res.ok) throw new Error("Failed to fetch templates");
    const templates = await res.json();

    const select = document.getElementById("templateSelect");
    select.innerHTML = `<option value="">Choose a template...</option>`;

    templates.forEach(t => {
      const option = document.createElement("option");
      option.value = JSON.stringify(t);
      option.textContent = t.name;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Could not load templates:", err);
  }
}

window.handleTemplateChange = function() {
  const select = document.getElementById("templateSelect");
  if (!select.value) return;

  const template = JSON.parse(select.value);
  document.getElementById("serviceName").value = template.name;
  document.getElementById("serviceDescription").value = template.description;
  document.getElementById("serviceDuration").value = template.duration;
};

async function loadServices() {
  try {
    const token = await getAuthToken();
    const res = await fetch(`/api/clinics/services?clinicId=${encodeURIComponent(currentClinicId)}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Failed to fetch services (${res.status})`);
    const services = await res.json();

    renderTable(services);
    renderStats(services);
  } catch (err) {
    showToast("Could not load services. Please try again.", "error");
    console.error("loadServices error:", err);
  }
}

function renderTable(services) {
  const tbody = document.getElementById("servicesTableBody");
  tbody.innerHTML = "";

  if (services.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No customized services yet. Click \"Add Custom Service\" to get started.";
    td.style.cssText = "text-align:center; color:#888; padding:2rem;";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  services.forEach(service => {
    const tr = document.createElement("tr");
    tr.dataset.serviceId = service.id;
    tr.style.borderBottom = "1px solid #e2e8f0";

    const nameTd = document.createElement("td");
    nameTd.textContent = service.name;
    nameTd.style.padding = "20px 24px";
    nameTd.style.fontWeight = "500";
    nameTd.style.color = "#0f172a";

    const durationTd = document.createElement("td");
    durationTd.textContent = `${service.duration} min`;
    durationTd.style.padding = "20px 24px";
    durationTd.style.color = "#475569";

    const descTd = document.createElement("td");
    descTd.textContent = service.description;
    descTd.style.padding = "20px 24px";
    descTd.style.color = "#64748b";

    const actionsTd = document.createElement("td");
    actionsTd.style.padding = "20px 24px";
    actionsTd.style.textAlign = "right";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "btn btn-secondary";
    editBtn.type = "button";
    editBtn.style.cssText = "padding: 6px 12px; font-size: 0.8rem; font-weight:600; border-radius:8px; margin-right:6px; cursor:pointer;";
    editBtn.addEventListener("click", () => openEditModal(service));

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.type = "button";
    deleteBtn.style.cssText = "padding: 6px 12px; font-size: 0.8rem; font-weight:600; border-radius:8px; color:#ef4444; background:#fef2f2; border:1px solid #fee2e2; cursor:pointer;";
    deleteBtn.addEventListener("click", () => {
      // Replace the row with an inline confirmation
      tr.innerHTML = "";
      const confirmTd = document.createElement("td");
      confirmTd.colSpan = 4;
      confirmTd.style.cssText = "padding: 14px 24px; background: #fff7f7; border-left: 3px solid #ef4444;";
      confirmTd.innerHTML = `
        <span style="color:#ef4444; font-weight:600; margin-right:16px;">Delete "${service.name}"? This cannot be undone.</span>
        <button id="confirmDeleteYes-${service.id}" type="button" style="padding:5px 14px; background:#ef4444; color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer; margin-right:8px;">Yes, Delete</button>
        <button id="confirmDeleteNo-${service.id}" type="button" style="padding:5px 14px; background:white; border:1px solid #cbd5e1; border-radius:6px; font-weight:600; cursor:pointer;">Cancel</button>
      `;
      tr.appendChild(confirmTd);

      document.getElementById(`confirmDeleteYes-${service.id}`).addEventListener("click", () => handleServiceDelete(service.id));
      document.getElementById(`confirmDeleteNo-${service.id}`).addEventListener("click", () => loadServices());
    });

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);

    tr.appendChild(nameTd);
    tr.appendChild(durationTd);
    tr.appendChild(descTd);
    tr.appendChild(actionsTd);

    tbody.appendChild(tr);
  });
}

function renderStats(services) {
  document.getElementById("totalServices").textContent = services.length;

  const avg = services.length
    ? Math.round(services.reduce((sum, s) => sum + s.duration, 0) / services.length)
    : 0;

  document.getElementById("avgDuration").textContent = `${avg} min`;
}

window.openServiceModal = function() {
  editingServiceId = null;
  document.getElementById("serviceModalTitle").textContent = "Add Custom Service";
  document.getElementById("serviceSubmitBtn").textContent = "Add Service";
  document.getElementById("serviceForm").reset();
  document.getElementById("templateSelectGroup").style.display = "block";
  document.getElementById("serviceModal").style.display = "flex";
};

window.openEditModal = function(service) {
  editingServiceId = service.id;
  document.getElementById("serviceModalTitle").textContent = "Edit Service";
  document.getElementById("serviceSubmitBtn").textContent = "Save Changes";

  document.getElementById("templateSelectGroup").style.display = "none";

  document.getElementById("serviceName").value = service.name;
  document.getElementById("serviceDescription").value = service.description;
  document.getElementById("serviceDuration").value = service.duration;

  document.getElementById("serviceModal").style.display = "flex";
};

window.closeServiceModal = function() {
  document.getElementById("serviceModal").style.display = "none";
  document.getElementById("serviceForm").reset();
  document.getElementById("templateSelectGroup").style.display = "block";
  editingServiceId = null;
};

window.handleServiceSubmit = async function(event) {
  event.preventDefault();

  const data = {
    name: document.getElementById("serviceName").value.trim(),
    description: document.getElementById("serviceDescription").value.trim(),
    duration: Number(document.getElementById("serviceDuration").value),
  };

  if (!data.name || !data.description || !data.duration || data.duration < 1) {
    showToast("Please fill in all fields correctly.", "error");
    return;
  }

  const url = editingServiceId
    ? `/api/clinics/services/${editingServiceId}`
    : `/api/clinics/services`;

  const method = editingServiceId ? "PUT" : "POST";
  const btn = document.getElementById("serviceSubmitBtn");
  btn.disabled = true;

  try {
    const token = await getAuthToken();
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (res.status === 409) {
      showToast("A service with that name already exists.", "error");
      btn.disabled = false;
      return;
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.error || `Server error ${res.status}`);
    }

    const wasEditing = editingServiceId;
    closeServiceModal();
    await loadServices();
    showToast(wasEditing ? "Service updated successfully!" : "Service added successfully!", "success");

  } catch (err) {
    showToast(err.message || "Could not save service. Please try again.", "error");
    console.error("handleServiceSubmit error:", err);
  } finally {
    btn.disabled = false;
  }
};

async function handleServiceDelete(id) {
  try {
    const token = await getAuthToken();
    const res = await fetch(`/api/clinics/services/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.error || `Server error ${res.status}`);
    }

    await loadServices();
    showToast("Service deleted successfully!", "success");

  } catch (err) {
    showToast(err.message || "Could not delete service. Please try again.", "error");
    console.error("handleServiceDelete error:", err);
    await loadServices(); // re-render to reset the confirmation row
  }
}

const searchInput = document.getElementById("serviceSearchInput");
if (searchInput) {
  searchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase();
    const rows = document.querySelectorAll("#servicesTableBody tr");
    rows.forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(query) ? "" : "none";
    });
  });
}
