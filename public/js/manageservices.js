let editingServiceId = null;

window.onload = () => {
  loadServices();
};

async function loadServices() {
  try {
    const res = await fetch(`/api/services`);
    if (!res.ok) throw new Error("Failed to fetch services");
    const services = await res.json();

    renderTable(services);
    renderStats(services);

  } catch (err) {
    showError("Could not load services. Please try again.");
    console.error(err);
  }
}

function renderTable(services) {
  const tbody = document.getElementById("servicesTableBody");
  tbody.innerHTML = "";

  if (services.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; color: #888; padding: 2rem;">
          No services yet. Click "Add Service" to get started.
        </td>
      </tr>`;
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

  const avgDuration = services.length
    ? Math.round(services.reduce((sum, s) => sum + s.duration, 0) / services.length)
    : 0;

  document.getElementById("avgDuration").textContent = `${avgDuration} min`;
}

// Called by the HTML "Add Service" button
function openModal() {
  editingServiceId = null;
  document.getElementById("modalTitle").textContent = "Add New Service";
  document.getElementById("submitBtn").textContent = "Add Service";
  document.getElementById("serviceForm").reset();
  document.getElementById("modalOverlay").classList.add("active");
}

function openEditModal(service) {
  editingServiceId = service.id;
  document.getElementById("modalTitle").textContent = "Edit Service";
  document.getElementById("submitBtn").textContent = "Save Changes";
  document.getElementById("serviceName").value = service.name;
  document.getElementById("serviceDescription").value = service.description;
  document.getElementById("serviceDuration").value = service.duration;
  document.getElementById("modalOverlay").classList.add("active");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("active");
  document.getElementById("serviceForm").reset();
  editingServiceId = null;
}

async function handleSubmit(event) {
  event.preventDefault();

  const data = {
    name: document.getElementById("serviceName").value.trim(),
    description: document.getElementById("serviceDescription").value.trim(),
    duration: Number(document.getElementById("serviceDuration").value),
  };

  try {
    if (editingServiceId) {
      const res = await fetch(`/api/services/${editingServiceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update service");
    } else {
      const res = await fetch(`/api/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to add service");
    }

    closeModal();
    loadServices();

  } catch (err) {
    showError("Could not save service. Please try again.");
    console.error(err);
  }
}

async function handleDelete(id) {
  if (!confirm("Are you sure you want to delete this service?")) return;

  try {
    const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete service");
    loadServices();
  } catch (err) {
    showError("Could not delete service. Please try again.");
    console.error(err);
  }
}

// Search — filters the table rows live
document.getElementById("searchInput").addEventListener("input", function () {
  const query = this.value.toLowerCase();
  const rows = document.querySelectorAll("#servicesTableBody tr");
  rows.forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query) ? "" : "none";
  });
});

function showError(message) {
  alert(message); // swap this for a toast/snackbar when you have one
}