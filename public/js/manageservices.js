// manageservices.js

let currentClinicId = null;
let editingServiceId = null;
window.authToken = null;

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

// ── SAVE FACILITY TYPE ──
document.getElementById('clinicProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('saveClinicProfileBtn');
    const status = document.getElementById('profileSaveStatus');
    
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Saving...';
    status.textContent = "";

    try {
        const facilityType = document.querySelector('input[name="facilityType"]:checked')?.value || "";

        await firebase.firestore().collection("clinics").doc(currentClinicId).update({
            facilityType: facilityType,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        status.textContent = "Saved successfully!";
        status.className = "save-status";
        setTimeout(() => { status.textContent = ""; }, 3000);
    } catch (err) {
        console.error("Error saving profile", err);
        status.textContent = "Error saving changes";
        status.className = "save-status error";
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = "<i class='bx bx-save'></i> Save Facility Type";
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
    const res = await fetch("/api/clinics/services", {
      headers: { "Authorization": `Bearer ${window.authToken}` }
    });
    if (!res.ok) throw new Error("Failed to fetch services");
    const services = await res.json();

    renderTable(services);
    renderStats(services);
  } catch (err) {
    showToast("Could not load services. Please try again.", "error");
    console.error(err);
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
    tr.style.borderBottom = "1px solid #e2e8f0";

    const nameTd = document.createElement("td");
    nameTd.textContent = service.name;
    nameTd.style.padding = "14px 18px";
    nameTd.style.fontWeight = "500";
    nameTd.style.color = "#0f172a";

    const durationTd = document.createElement("td");
    durationTd.textContent = `${service.duration} min`;
    durationTd.style.padding = "14px 18px";
    durationTd.style.color = "#475569";

    const descTd = document.createElement("td");
    descTd.textContent = service.description;
    descTd.style.padding = "14px 18px";
    descTd.style.color = "#64748b";

    const actionsTd = document.createElement("td");
    actionsTd.style.padding = "14px 18px";
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
    deleteBtn.addEventListener("click", () => handleServiceDelete(service.id));

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
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${window.authToken}`,
      },
      body: JSON.stringify(data),
    });

    if (res.status === 409) {
      showToast("A service with that name already exists.", "error");
      btn.disabled = false;
      return;
    }

    if (!res.ok) throw new Error("Failed to save service");

    closeServiceModal();
    await loadServices();
    showToast(editingServiceId ? "Service updated successfully!" : "Service added successfully!", "success");

  } catch (err) {
    showToast("Could not save service. Please try again.", "error");
    console.error(err);
  } finally {
    btn.disabled = false;
  }
};

async function handleServiceDelete(id) {
  if (!confirm("Are you sure you want to delete this service?")) return;

  try {
    const res = await fetch(`/api/clinics/services/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${window.authToken}` }
    });

    if (!res.ok) throw new Error("Failed to delete service");
    await loadServices();
    showToast("Service deleted successfully!", "success");

  } catch (err) {
    showToast("Could not delete service. Please try again.", "error");
    console.error(err);
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
