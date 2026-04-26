
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  try {
    // Force refresh to pick up custom claims (clinicId)
    const token = await user.getIdToken(true);
    window.authToken = token;

    // Verify admin role via your existing API
    const res = await fetch(`/api/user/login/${user.uid}?email=${encodeURIComponent(user.email || "")}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Profile fetch failed");
    const result = await res.json();

    if (!result.exists || !result.profile || result.profile.role !== "admin") {
      window.location.href = "dashboard.html";
      return;
    }

    // All good — boot the page
    await loadTemplates();
    await loadServices();

  } catch (err) {
    console.error("Auth error:", err);
    window.location.href = "login.html";
  }
});


let editingServiceId = null;

async function loadServices() {
  try {
    const res = await fetch("/api/services", {
      headers: { "Authorization": `Bearer ${window.authToken}` }
    });
    if (!res.ok) throw new Error("Failed to fetch services");
    const services = await res.json();

    renderTable(services);
    renderStats(services);

  } catch (err) {
    showError("Could not load services. Please try again.");
    console.error(err);
  }
}


async function loadTemplates() {
  try {
    const res = await fetch("/api/services/templates", {
      headers: { "Authorization": `Bearer ${window.authToken}` }
    });
    if (!res.ok) throw new Error("Failed to fetch templates");
    const templates = await res.json();

    const select = document.getElementById("templateSelect");
    select.innerHTML = `<option value="">Choose a service...</option>`;

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


function handleTemplateChange() {
  const select = document.getElementById("templateSelect");
  if (!select.value) return;

  const template = JSON.parse(select.value);
  document.getElementById("serviceName").value = template.name;
  document.getElementById("serviceDescription").value = template.description;
  document.getElementById("serviceDuration").value = template.duration;
}


function renderTable(services) {
  const tbody = document.getElementById("servicesTableBody");
  tbody.innerHTML = "";

  if (services.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = "No services yet. Click \"Add Service\" to get started.";
    td.style.cssText = "text-align:center; color:#888; padding:2rem;";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  services.forEach(service => {
    const tr = document.createElement("tr");

    const nameTd = document.createElement("td");
    nameTd.textContent = service.name;

    const durationTd = document.createElement("td");
    durationTd.textContent = `${service.duration} min`;

    const descTd = document.createElement("td");
    descTd.textContent = service.description;

    const actionsTd = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "btn btn-secondary";
    editBtn.addEventListener("click", () => openEditModal(service));

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "btn btn-danger";
    deleteBtn.addEventListener("click", () => handleDelete(service.id));

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


function openModal() {
  editingServiceId = null;
  document.getElementById("modalTitle").textContent = "Add New Service";
  document.getElementById("submitBtn").textContent = "Add Service";
  document.getElementById("serviceForm").reset();
  document.getElementById("templateSelectGroup").style.display = "block";
  document.getElementById("modalOverlay").classList.add("active");
}


function openEditModal(service) {
  editingServiceId = service.id;
  document.getElementById("modalTitle").textContent = "Edit Service";
  document.getElementById("submitBtn").textContent = "Save Changes";

  
  document.getElementById("templateSelectGroup").style.display = "none";


  document.getElementById("serviceName").value = service.name;
  document.getElementById("serviceDescription").value = service.description;
  document.getElementById("serviceDuration").value = service.duration;

  document.getElementById("modalOverlay").classList.add("active");
}


function closeModal() {
  document.getElementById("modalOverlay").classList.remove("active");
  document.getElementById("serviceForm").reset();
  document.getElementById("templateSelectGroup").style.display = "block";
  editingServiceId = null;
}


async function handleSubmit(event) {
  event.preventDefault();

  const data = {
    name: document.getElementById("serviceName").value.trim(),
    description: document.getElementById("serviceDescription").value.trim(),
    duration: Number(document.getElementById("serviceDuration").value),
  };

  // Basic client-side guard
  if (!data.name || !data.description || !data.duration || data.duration < 1) {
    showError("Please fill in all fields correctly.");
    return;
  }

  const url = editingServiceId
    ? `/api/services/${editingServiceId}`
    : `/api/services`;

  const method = editingServiceId ? "PUT" : "POST";

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
      showError("A service with that name already exists.");
      return;
    }

    if (!res.ok) throw new Error("Failed to save service");

    closeModal();
    await loadServices();

  } catch (err) {
    showError("Could not save service. Please try again.");
    console.error(err);
  }
}

// ── DELETE ──────────────────────────────────────────────────
async function handleDelete(id) {
  if (!confirm("Are you sure you want to delete this service?")) return;

  try {
    const res = await fetch(`/api/services/${id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${window.authToken}` }
    });

    if (!res.ok) throw new Error("Failed to delete service");
    await loadServices();

  } catch (err) {
    showError("Could not delete service. Please try again.");
    console.error(err);
  }
}

document.getElementById("searchInput").addEventListener("input", function () {
  const query = this.value.toLowerCase();
  const rows = document.querySelectorAll("#servicesTableBody tr");
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query) ? "" : "none";
  });
});


function showError(message) {
  alert(message); 
}