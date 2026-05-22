document.addEventListener("DOMContentLoaded", () => {
    let currentClinicId = null;
let reportData = null;
let charts = {};

// ── AUTH ─────────────────────────────────────────────────
firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = "index.html"; return; }

    try {
        const idToken = await user.getIdToken();
        const response = await fetch(`/api/user/login/${user.uid}?email=${encodeURIComponent(user.email || "")}`, {
            headers: { "Authorization": `Bearer ${idToken}` }
        });

        const result = await response.json();
        if (!result.exists || !result.profile || result.profile.role !== "admin") {
            window.location.href = "index.html";
            return;
        }

        currentClinicId = result.profile.clinicId;
        initDefaultDates();
        await loadStaffFilter();

    } catch (err) {
        console.error("Auth error:", err);
        window.location.href = "dashboard.html";
    }
});

// ── DEFAULTS ─────────────────────────────────────────────
// Sets the report date range to the last 30 days by default.
function initDefaultDates() {
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);
    document.getElementById("endDate").value = today.toISOString().split("T")[0];
    document.getElementById("startDate").value = monthAgo.toISOString().split("T")[0];
}

// ── STAFF FILTER DROPDOWN ────────────────────────────────
// Loads approved staff members into the optional staff filter dropdown.
async function loadStaffFilter() {
    if (!currentClinicId) return;
    try {
        const idToken = await firebase.auth().currentUser.getIdToken();
        const res = await fetch(`/api/admin/active-staff?clinicId=${currentClinicId}`, {
            headers: { "Authorization": `Bearer ${idToken}` }
        });
        const result = await res.json();
        if (result.success && result.staff) {
            const select = document.getElementById("staffFilter");
            result.staff.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.uid;
                opt.textContent = s.fullName;
                select.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Error loading staff filter:", err);
    }
}

// ── RUN REPORT ───────────────────────────────────────────


// Requests the staff utilisation report for the selected date range and
// applies the optional staff filter before rendering.
async function runReport() {
  console.log("runReport fired", currentClinicId);
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const staffFilter = document.getElementById("staffFilter").value;

    if (!startDate || !endDate) {
        alert("Please select a date range.");
        return;
    }

    if (new Date(startDate) > new Date(endDate)) {
        alert("Start date must be before end date.");
        return;
    }

    const btn = document.getElementById("runBtn");
    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader spin'></i> Loading…`;

    try {
        const idToken = await firebase.auth().currentUser.getIdToken();
        const res = await fetch(
            `/api/clinics/${currentClinicId}/staff-utilisation?startDate=${startDate}&endDate=${endDate}`,
            { headers: { "Authorization": `Bearer ${idToken}` } }
        );

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to load report");

        let data = result.data;

        // Apply staff filter client-side
        if (staffFilter !== "all") {
            data = {
                ...data,
                staffList: data.staffList.filter(s => s.uid === staffFilter)
            };
        }

        reportData = data;
        renderReport(data, startDate, endDate);

    } catch (err) {
        console.error("Report error:", err);
        alert("Failed to load report: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class='bx bx-play'></i> Run Report`;
    }
}
document.getElementById("runBtn").addEventListener("click", runReport);
// ── RENDER ───────────────────────────────────────────────
// Reveals the report area and coordinates all report visualizations.
function renderReport(data, startDate, endDate) {
    document.getElementById("emptyState").style.display = "none";
    document.getElementById("reportContent").style.display = "block";
    document.getElementById("exportGroup").style.display = "flex";
    document.getElementById("reportSubtitle").textContent =
        `${data.clinicName} · ${formatDate(startDate)} – ${formatDate(endDate)}`;

    renderKPIs(data);
    renderBarChart(data);
    renderDonutChart(data);
    renderHeatmap(data);
    renderTable(data.staffList);
}

// ── KPIs ─────────────────────────────────────────────────
// Calculates and renders top-level staff workload metrics.
function renderKPIs(data) {
    const total = data.totalPatients;
    const staff = data.staffList;
    const active = staff.filter(s => s.patientsHandled > 0).length;
    const avgPatients = staff.length > 0 ? Math.round(total / staff.length) : 0;
    const topStaff = staff.reduce((a, b) => a.patientsHandled > b.patientsHandled ? a : b, { patientsHandled: 0, fullName: "—" });
    const completionRate = total > 0
        ? Math.round((staff.reduce((s, m) => s + m.consultationsCompleted, 0) / total) * 100)
        : 0;

    document.getElementById("kpiGrid").innerHTML = `
        <article class="kpi-card accent-blue">
            <p class="kpi-label">Total Patients</p>
            <output class="kpi-value">${total}</output>
            <p class="kpi-sub">Across all staff in period</p>
        </article>
        <article class="kpi-card accent-green">
            <p class="kpi-label">Active Staff</p>
            <output class="kpi-value">${active}<small style="font-size:1rem;color:var(--text-muted)"> / ${staff.length}</small></output>
            <p class="kpi-sub">Staff with patient activity</p>
        </article>
        <article class="kpi-card">
            <p class="kpi-label">Avg Patients / Staff</p>
            <output class="kpi-value">${avgPatients}</output>
            <p class="kpi-sub">Average workload per member</p>
        </article>
        <article class="kpi-card accent-orange">
            <p class="kpi-label">Completion Rate</p>
            <output class="kpi-value">${completionRate}%</output>
            <p class="kpi-sub">Consultations marked completed</p>
        </article>
        <article class="kpi-card">
            <p class="kpi-label">Top Performer</p>
            <output class="kpi-value" style="font-size:1.2rem;font-family:'DM Sans',sans-serif;">${topStaff.fullName.split(" ")[0]}</output>
            <p class="kpi-sub">${topStaff.patientsHandled} patients handled</p>
        </article>
    `;
}

// ── BAR CHART ────────────────────────────────────────────
// Draws the patients-handled vs completed-consultations bar chart.
function renderBarChart(data) {
    if (charts.bar) charts.bar.destroy();
    const ctx = document.getElementById("patientsBarChart").getContext("2d");
    const labels = data.staffList.map(s => s.fullName.split(" ")[0]);
    const values = data.staffList.map(s => s.patientsHandled);
    const completed = data.staffList.map(s => s.consultationsCompleted);

    charts.bar = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: "Patients Handled",
                    data: values,
                    backgroundColor: "#2563eb",
                    borderRadius: 6
                },
                {
                    label: "Completed",
                    data: completed,
                    backgroundColor: "#16a34a",
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "top", labels: { font: { family: "DM Sans", size: 12 } } } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: "DM Sans" } } },
                y: { grid: { color: "#e2e6f0" }, ticks: { font: { family: "DM Mono" } }, beginAtZero: true }
            }
        }
    });
}

// ── DONUT CHART ──────────────────────────────────────────
// Draws workload share as a donut chart across staff members.
function renderDonutChart(data) {
    if (charts.donut) charts.donut.destroy();
    const ctx = document.getElementById("workloadDonutChart").getContext("2d");
    const labels = data.staffList.map(s => s.fullName.split(" ")[0]);
    const values = data.staffList.map(s => s.workloadShare);
    const colors = ["#2563eb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#be185d","#65a30d"];

    charts.donut = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "right", labels: { font: { family: "DM Sans", size: 12 }, padding: 12 } },
                tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` } }
            }
        }
    });
}

// ── HEATMAP ──────────────────────────────────────────────
// Renders hourly staff activity as a heatmap grid.
function renderHeatmap(data) {
    const wrap = document.getElementById("heatmapWrap");
    if (!data.staffList.length) { wrap.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No data</p>'; return; }

    const maxVal = Math.max(...data.staffList.flatMap(s => s.hourlyActivity));

    let html = '<section class="heatmap-hours" aria-label="Hours of day">';
    for (let h = 0; h < 24; h++) {
        html += `<time class="heatmap-hour-label" datetime="${String(h).padStart(2,"0")}:00">${String(h).padStart(2,"0")}</time>`;
    }
    html += '</section><section class="heatmap-grid" aria-label="Hourly patient activity by staff member">';

    data.staffList.forEach(s => {
        html += `<section class="heatmap-row"><p class="heatmap-label" title="${s.fullName}">${s.fullName.split(" ")[0]}</p>`;
        s.hourlyActivity.forEach((val, h) => {
            const intensity = maxVal > 0 ? val / maxVal : 0;
            const bg = interpolateColor(intensity);
            html += `<output class="heatmap-cell" style="background:${bg}" data-tip="${s.fullName.split(" ")[0]} · ${String(h).padStart(2,"0")}:00 · ${val} patients" aria-label="${s.fullName.split(" ")[0]} ${String(h).padStart(2,"0")}:00 ${val} patients"></output>`;
        });
        html += '</section>';
    });

    html += '</section>';
    wrap.innerHTML = html;
}

// Converts heatmap intensity into an RGB color between low and high activity.
function interpolateColor(t) {
    if (t === 0) return "#e2e6f0";
    const r = Math.round(37 + (220 - 37) * (1 - t));
    const g = Math.round(99 + (38 - 99) * t);
    const b = Math.round(235 + (38 - 235) * t);
    return `rgb(${r},${g},${b})`;
}

// ── TABLE ────────────────────────────────────────────────
// Renders the staff table and wires its search filter.
function renderTable(staffList) {
    buildTableRows(staffList);

    document.getElementById("tableSearch").addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = staffList.filter(s => s.fullName.toLowerCase().includes(q));
        buildTableRows(filtered);
    });
}

// Builds the staff table rows and calculates per-row workload status labels.
function buildTableRows(staffList) {
    const tbody = document.getElementById("staffTableBody");

    if (!staffList.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">No staff data found.</td></tr>`;
        return;
    }

    const avgPatients = staffList.reduce((s, m) => s + m.patientsHandled, 0) / staffList.length;

    tbody.innerHTML = staffList.map(s => {
        const peakHour = s.hourlyActivity.indexOf(Math.max(...s.hourlyActivity));
        const peakLabel = s.hourlyActivity[peakHour] > 0
            ? `${String(peakHour).padStart(2,"0")}:00 – ${String(peakHour+1).padStart(2,"0")}:00`
            : "—";

        const status = s.patientsHandled === 0
            ? `<mark class="badge badge-red">Inactive</mark>`
            : s.patientsHandled > avgPatients * 1.3
            ? `<mark class="badge badge-orange">High Load</mark>`
            : `<mark class="badge badge-green">Active</mark>`;

        return `
            <tr>
                <td>
                    <section class="staff-name-cell">
                        <abbr class="avatar" title="${s.fullName}">${s.fullName[0].toUpperCase()}</abbr>
                        <address style="font-style:normal;">
                            <strong style="font-weight:600;">${s.fullName}</strong>
                            <a href="mailto:${s.email}" style="display:block;font-size:0.78rem;color:var(--text-muted);text-decoration:none;">${s.email}</a>
                        </address>
                    </section>
                </td>
                <td style="font-family:'DM Mono',monospace;font-weight:600;">${s.patientsHandled}</td>
                <td style="font-family:'DM Mono',monospace;">${s.consultationsCompleted}</td>
                <td>
                    <section class="workload-bar-wrap">
                        <progress class="workload-progress" value="${s.workloadShare}" max="100" aria-label="${s.fullName} workload share"></progress>
                        <output class="workload-pct">${s.workloadShare}%</output>
                    </section>
                </td>
                <td style="font-family:'DM Mono',monospace;font-size:0.82rem;">${peakLabel}</td>
                <td>${status}</td>
            </tr>
        `;
    }).join("");
}

// ── CSV EXPORT ───────────────────────────────────────────
document.getElementById("exportCsvBtn").addEventListener("click", exportCSV);

// Downloads the current staff utilisation report as a CSV file.
function exportCSV() {
    if (!reportData) return;
    const { staffList, dateRange, clinicName } = reportData;

    const headers = ["Name","Email","Patients Handled","Completed","Workload Share (%)","Peak Hour","Status"];
    const avgPatients = staffList.reduce((s, m) => s + m.patientsHandled, 0) / staffList.length;

    const rows = staffList.map(s => {
        const peakHour = s.hourlyActivity.indexOf(Math.max(...s.hourlyActivity));
        const peakLabel = s.hourlyActivity[peakHour] > 0 ? `${peakHour}:00` : "—";
        const status = s.patientsHandled === 0 ? "Inactive"
            : s.patientsHandled > avgPatients * 1.3 ? "High Load" : "Active";
        return [s.fullName, s.email, s.patientsHandled, s.consultationsCompleted, s.workloadShare, peakLabel, status];
    });

    const csv = [
        [`Staff Utilisation Report — ${clinicName}`],
        [`Period: ${dateRange.startDate} to ${dateRange.endDate}`],
        [],
        headers,
        ...rows
    ].map(r => r.map(v => `"${v}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-utilisation-${dateRange.startDate}-${dateRange.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── PDF EXPORT ───────────────────────────────────────────
document.getElementById("exportPdfBtn").addEventListener("click", exportPDF);

// Generates a landscape PDF version of the current staff utilisation report.
async function exportPDF() {
    if (!reportData) return;
    const btn = document.getElementById("exportPdfBtn");
    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-loader spin'></i> Generating…`;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const { staffList, dateRange, clinicName, totalPatients } = reportData;
        const pageW = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, pageW, 22, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Staff Utilisation Report", 14, 14);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`${clinicName} · ${formatDate(dateRange.startDate)} – ${formatDate(dateRange.endDate)}`, pageW - 14, 14, { align: "right" });

        // KPI row
        const active = staffList.filter(s => s.patientsHandled > 0).length;
        const completionRate = totalPatients > 0
            ? Math.round((staffList.reduce((s, m) => s + m.consultationsCompleted, 0) / totalPatients) * 100) : 0;
        const avgP = staffList.length > 0 ? Math.round(totalPatients / staffList.length) : 0;

        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        const kpis = [
            ["TOTAL PATIENTS", totalPatients],
            ["ACTIVE STAFF", `${active} / ${staffList.length}`],
            ["AVG PATIENTS / STAFF", avgP],
            ["COMPLETION RATE", `${completionRate}%`]
        ];
        const kpiW = (pageW - 28) / kpis.length;
        kpis.forEach(([label, val], i) => {
            const x = 14 + i * kpiW;
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(7);
            doc.text(label, x, 32);
            doc.setTextColor(15, 23, 42);
            doc.setFontSize(13);
            doc.setFont("helvetica", "bold");
            doc.text(String(val), x, 40);
        });

        // Table
        const avgPatients = staffList.reduce((s, m) => s + m.patientsHandled, 0) / staffList.length;
        const tableRows = staffList.map(s => {
            const peakHour = s.hourlyActivity.indexOf(Math.max(...s.hourlyActivity));
            const peakLabel = s.hourlyActivity[peakHour] > 0 ? `${String(peakHour).padStart(2,"0")}:00` : "—";
            const status = s.patientsHandled === 0 ? "Inactive"
                : s.patientsHandled > avgPatients * 1.3 ? "High Load" : "Active";
            return [s.fullName, s.email, s.patientsHandled, s.consultationsCompleted, `${s.workloadShare}%`, peakLabel, status];
        });

        doc.autoTable({
            startY: 50,
            head: [["Staff Member", "Email", "Patients", "Completed", "Share", "Peak Hour", "Status"]],
            body: tableRows,
            theme: "grid",
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8, fontStyle: "bold" },
            bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
            alternateRowStyles: { fillColor: [248, 249, 252] },
            columnStyles: { 0: { fontStyle: "bold" }, 4: { halign: "center" }, 5: { halign: "center" }, 6: { halign: "center" } },
            margin: { left: 14, right: 14 },
            didParseCell(data) {
                if (data.section === "body" && data.column.index === 6) {
                    const val = data.cell.raw;
                    if (val === "Inactive") data.cell.styles.textColor = [220, 38, 38];
                    else if (val === "High Load") data.cell.styles.textColor = [217, 119, 6];
                    else data.cell.styles.textColor = [22, 163, 74];
                }
            }
        });

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(150);
            doc.text(`Generated ${new Date().toLocaleString()} · smartClinic`, 14, doc.internal.pageSize.getHeight() - 6);
            doc.text(`Page ${i} of ${pageCount}`, pageW - 14, doc.internal.pageSize.getHeight() - 6, { align: "right" });
        }

        doc.save(`staff-utilisation-${dateRange.startDate}-${dateRange.endDate}.pdf`);
    } catch (err) {
        console.error("PDF error:", err);
        alert("Failed to generate PDF.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class='bx bx-file-pdf'></i> Export PDF`;
    }
}

// ── UTILS ────────────────────────────────────────────────
// Formats report dates for headings and exported files.
function formatDate(str) {
    return new Date(str).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}


});

