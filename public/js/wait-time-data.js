// wait-time-data.js
// Data layer for the Average Patient Wait Times report.
// Mirrors the pattern established in no-show-data.js.

// ── FIREBASE LAYERING SIDE EFFECTS ───────────────────────────
import "./firebase-config.js";

// Data stash for running downloads
let globalReportData = null;

// Get the initialized global namespace context
const firebaseInstance = typeof firebase !== "undefined" ? firebase : window.firebase;
const db = firebaseInstance.firestore();

// ─────────────────────────────────────────────────────────────
// Wait-time colour coding helpers
// ─────────────────────────────────────────────────────────────
export function waitColor(minutes) {
  if (minutes >= 45) return "#ef4444";   // red   – long wait
  if (minutes >= 20) return "#f59e0b";   // amber – moderate
  return "#10b981";                       // green – fast
}

// ─────────────────────────────────────────────────────────────
// Rendering Handlers
// ─────────────────────────────────────────────────────────────
export function renderKPIs({ totalCompleted, overallAvg, peakHour, quietHour, longestDay, shortestDay }) {
  const items = [
    { label: "Appointments Analysed", value: totalCompleted.toLocaleString(), icon: "📋", color: "blue"  },
    { label: "Overall Avg Wait",      value: overallAvg + " min",             icon: "⏱",  color: overallAvg >= 45 ? "red" : overallAvg >= 20 ? "amber" : "green" },
    { label: "Busiest Hour",          value: peakHour,                        icon: "🔺", color: "red"   },
    { label: "Quietest Hour",         value: quietHour,                       icon: "🔹", color: "green" },
    { label: "Longest Wait Day",      value: longestDay,                      icon: "📅", color: "amber" },
    { label: "Shortest Wait Day",     value: shortestDay,                     icon: "✅", color: "green" },
  ];

  document.getElementById("kpi-list").innerHTML = items.map(k => `
    <article class="kpi-card kpi-${k.color}" aria-label="${k.label}: ${k.value}">
      <span class="kpi-icon" aria-hidden="true">${k.icon}</span>
      <output class="kpi-value">${k.value}</output>
      <p class="kpi-label">${k.label}</p>
    </article>
  `).join("");
}

export function renderTimeOfDayChart(byTimeOfDay) {
  const fig = document.getElementById("tod-chart");
  if (!byTimeOfDay.length) {
    fig.innerHTML = '<p class="empty-msg">No time-of-day data for this period.</p>';
    return;
  }
  const max = Math.max(...byTimeOfDay.map(t => t.avgWaitMinutes), 1);
  fig.innerHTML = `
    <figcaption class="sr-only">Bar chart: average patient wait time by hour of day.</figcaption>
    <ul class="bar-chart" role="list" aria-label="Avg wait time by hour">
      ${byTimeOfDay.map(t => {
        const color = waitColor(t.avgWaitMinutes);
        const label = formatHour(t.timeSlot);
        return `
          <li class="bar-group" aria-label="${label}: ${t.avgWaitMinutes} min avg (${t.appointmentsCompleted} appointments)">
            <span class="bar-tooltip" role="tooltip">${t.avgWaitMinutes} min avg · ${t.appointmentsCompleted} appts</span>
            <span class="bar-col" aria-hidden="true">
              <span class="bar-fill" style="height:${(t.avgWaitMinutes / max) * 160}px; background:${color};">
                <span class="bar-val">${t.avgWaitMinutes}m</span>
              </span>
            </span>
            <span class="bar-label">${label}</span>
          </li>`;
      }).join("")}
    </ul>`;
}

export function renderDailyChart(byDate) {
  const fig = document.getElementById("daily-chart");
  if (!byDate.length) {
    fig.innerHTML = '<p class="empty-msg">No daily data for this period.</p>';
    return;
  }
  const max = Math.max(...byDate.map(d => d.avgWaitMinutes), 1);
  fig.innerHTML = `
    <figcaption class="sr-only">Bar chart: average patient wait time by date.</figcaption>
    <ul class="bar-chart" role="list" aria-label="Avg wait time by date">
      ${byDate.map(d => {
        const color = waitColor(d.avgWaitMinutes);
        const label = new Date(d.date + "T00:00:00").toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
        return `
          <li class="bar-group" aria-label="${label}: ${d.avgWaitMinutes} min avg">
            <span class="bar-tooltip" role="tooltip">${label} · ${d.avgWaitMinutes} min · ${d.appointmentsCompleted} appts</span>
            <span class="bar-col" aria-hidden="true">
              <span class="bar-fill" style="height:${(d.avgWaitMinutes / max) * 160}px; background:${color};">
                <span class="bar-val">${d.avgWaitMinutes}m</span>
              </span>
            </span>
            <span class="bar-label"><time datetime="${d.date}">${label}</time></span>
          </li>`;
      }).join("")}
    </ul>`;
}

export function renderServiceBreakdown(byService) {
  const el = document.getElementById("service-bars");
  if (!byService.length) {
    el.innerHTML = '<p class="empty-msg">No service breakdown data available.</p>';
    return;
  }
  el.innerHTML = `
    <dl class="h-bar-list">
      ${byService.map(s => {
        const color = waitColor(s.avgWaitMinutes);
        const pct   = Math.min(Math.round((s.avgWaitMinutes / 60) * 100), 100);
        return `
          <div class="h-bar-row">
            <dt class="h-bar-name" title="${s.serviceName}">${s.serviceName}</dt>
            <dd class="h-bar-meter">
              <meter min="0" max="100" value="${pct}"
                aria-label="${s.serviceName}: ${s.avgWaitMinutes} min avg"
                style="--fill:${color}"></meter>
            </dd>
            <dd class="h-bar-stat" aria-label="${s.avgWaitMinutes} min avg, ${s.count} appointments">
              ${s.avgWaitMinutes} min&nbsp;<span>(${s.count} appts)</span>
            </dd>
          </div>`;
      }).join("")}
    </dl>`;
}

export function renderAppointmentsTable(appointments) {
  const tbody = document.getElementById("appt-tbody");
  if (!appointments.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No appointments with service duration data found for this period.</td></tr>`;
    return;
  }
  tbody.innerHTML = appointments.slice(0, 50).map(a => {
    const waitColor_ = a.serviceDuration >= 45 ? "badge-long" : a.serviceDuration >= 20 ? "badge-mid" : "badge-fast";
    const waitLabel  = a.serviceDuration >= 45 ? "Long"       : a.serviceDuration >= 20 ? "Moderate"  : "Fast";
    return `<tr>
      <td><time datetime="${a.date}">${formatDate(a.date)}</time></td>
      <td>${formatHour(a.timeSlot)}</td>
      <td>${escHtml(a.serviceName || "–")}</td>
      <td><strong>${a.serviceDuration} min</strong></td>
      <td>${escHtml(a.clinicName || "–")}</td>
      <td><mark class="badge-wait ${waitColor_}" aria-label="Wait: ${waitLabel}">${waitLabel}</mark></td>
    </tr>`;
  }).join("");
}

// ─────────────────────────────────────────────────────────────
// Layout States Handler
// ─────────────────────────────────────────────────────────────
export function showLoader(on) {
  document.getElementById("loader").hidden       = !on;
  document.getElementById("report-body").hidden  =  on;
}

export function showError(msg) {
  document.getElementById("loader").hidden       = true;
  document.getElementById("report-body").hidden  = false;
  document.getElementById("report-body").innerHTML = `
    <p role="alert" class="error-box">
      <strong>Error loading data:</strong> ${msg}<br>
      <small>Check your Firebase configuration setup and your Firestore security rules.</small>
    </p>`;
}

// ─────────────────────────────────────────────────────────────
// Export Methods
// ─────────────────────────────────────────────────────────────
export function exportCSV() {
  if (!globalReportData) return;

  const { metrics, byTimeOfDay, byDate, byService, appointments } = globalReportData;
  const csvCell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csvRow  = arr => arr.map(csvCell).join(",");
  const rows    = [];

  rows.push(["AVERAGE PATIENT WAIT TIMES REPORT"]);
  rows.push(["Generated", new Date().toLocaleString("en-ZA")]);
  rows.push(["Date Range", document.getElementById("dateRange").selectedOptions[0].text]);
  rows.push([]);

  rows.push(["── SUMMARY METRICS ──"]);
  rows.push(["Appointments Analysed", metrics.totalCompleted]);
  rows.push(["Overall Avg Wait (min)", metrics.overallAvg]);
  rows.push(["Busiest Hour",           metrics.peakHour]);
  rows.push(["Quietest Hour",          metrics.quietHour]);
  rows.push(["Longest Wait Day",       metrics.longestDay]);
  rows.push(["Shortest Wait Day",      metrics.shortestDay]);
  rows.push([]);

  rows.push(["── WAIT TIMES BY HOUR OF DAY ──"]);
  rows.push(["Hour", "Appointments", "Avg Wait (min)"]);
  byTimeOfDay.forEach(t => rows.push([formatHour(t.timeSlot), t.appointmentsCompleted, t.avgWaitMinutes]));
  rows.push([]);

  rows.push(["── WAIT TIMES BY DATE ──"]);
  rows.push(["Date", "Appointments", "Avg Wait (min)"]);
  byDate.forEach(d => rows.push([d.date, d.appointmentsCompleted, d.avgWaitMinutes]));
  rows.push([]);

  rows.push(["── WAIT TIMES BY SERVICE TYPE ──"]);
  rows.push(["Service", "Appointments", "Avg Wait (min)"]);
  byService.forEach(s => rows.push([s.serviceName, s.count, s.avgWaitMinutes]));
  rows.push([]);

  rows.push(["── APPOINTMENT DETAIL LOG ──"]);
  rows.push(["Date", "Hour", "Service", "Duration (min)", "Clinic"]);
  appointments.forEach(a => rows.push([a.date, formatHour(a.timeSlot), a.serviceName || "", a.serviceDuration, a.clinicName || ""]));

  const csv  = rows.map(csvRow).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `wait-time-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportPDF() {
  if (!globalReportData) { window.print(); return; }

  const { metrics, byTimeOfDay, byDate, byService, appointments } = globalReportData;
  const range = document.getElementById("dateRange").selectedOptions[0].text;

  const barHtml = (minutes, max) => {
    const color = minutes >= 45 ? "#dc2626" : minutes >= 20 ? "#d97706" : "#059669";
    const pct   = Math.min(Math.round((minutes / Math.max(max, 1)) * 100), 100);
    return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
      <div style="flex:1;background:#f3f4f6;border-radius:4px;height:10px">
        <div style="width:${pct}%;background:${color};height:10px;border-radius:4px"></div>
      </div>
      <span style="font-weight:600;min-width:52px;text-align:right;color:${color}">${minutes} min</span>
    </div>`;
  };

  const maxTod     = Math.max(...byTimeOfDay.map(t => t.avgWaitMinutes), 1);
  const maxDate    = Math.max(...byDate.map(d => d.avgWaitMinutes), 1);
  const maxService = Math.max(...byService.map(s => s.avgWaitMinutes), 1);

  const kpiCard = (label, value, color) =>
    `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;text-align:center;min-width:130px">
      <div style="font-size:22px;font-weight:700;color:${color}">${value}</div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">${label}</div>
    </div>`;

  const todRows = byTimeOfDay.map(t =>
    `<tr><td>${formatHour(t.timeSlot)}</td><td style="text-align:center">${t.appointmentsCompleted}</td>
     <td>${barHtml(t.avgWaitMinutes, maxTod)}</td></tr>`).join("");

  const dateRows = byDate.map(d =>
    `<tr><td>${d.date}</td><td style="text-align:center">${d.appointmentsCompleted}</td>
     <td>${barHtml(d.avgWaitMinutes, maxDate)}</td></tr>`).join("");

  const serviceRows = byService.map(s =>
    `<tr><td>${escHtml(s.serviceName)}</td><td style="text-align:center">${s.count}</td>
     <td>${barHtml(s.avgWaitMinutes, maxService)}</td></tr>`).join("");

  const apptRows = appointments.slice(0, 100).map(a => {
    const badge = a.serviceDuration >= 45 ? "#fee2e2;color:#991b1b" :
                  a.serviceDuration >= 20 ? "#fef3c7;color:#92400e" : "#d1fae5;color:#065f46";
    const label = a.serviceDuration >= 45 ? "Long" : a.serviceDuration >= 20 ? "Moderate" : "Fast";
    return `<tr>
      <td>${a.date}</td>
      <td>${formatHour(a.timeSlot)}</td>
      <td>${escHtml(a.serviceName || "–")}</td>
      <td style="text-align:center;font-weight:600">${a.serviceDuration}</td>
      <td>${escHtml(a.clinicName || "–")}</td>
      <td><span style="background:${badge};padding:2px 8px;border-radius:99px;font-size:11px">${label}</span></td>
    </tr>`;
  }).join("");

  const avgColor = metrics.overallAvg >= 45 ? "#dc2626" : metrics.overallAvg >= 20 ? "#d97706" : "#059669";

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Average Patient Wait Times Report</title>
    <style>
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#111827; padding:32px; }
      h1 { font-size:22px; font-weight:700; } h1 em { color:#0d9488; font-style:normal; }
      h2 { font-size:14px; font-weight:600; color:#374151; margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid #e5e7eb; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
      .meta { font-size:11px; color:#6b7280; text-align:right; line-height:1.8; }
      .kpis { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:28px; }
      .section { margin-bottom:28px; }
      table { width:100%; border-collapse:collapse; font-size:12px; }
      th { background:#f9fafb; padding:8px 10px; text-align:left; font-weight:600; color:#374151; border-bottom:2px solid #e5e7eb; }
      td { padding:7px 10px; border-bottom:1px solid #f3f4f6; vertical-align:middle; }
      tr:nth-child(even) td { background:#fafafa; }
      @media print { body { padding:16px; } @page { margin:1cm; } }
    </style></head><body>
    <div class="header">
      <div><h1>Average Patient <em>Wait Times</em> Report</h1></div>
      <div class="meta">
        <div><strong>Date Range:</strong> ${range}</div>
        <div><strong>Generated:</strong> ${new Date().toLocaleString("en-ZA")}</div>
      </div>
    </div>

    <div class="kpis">
      ${kpiCard("Appointments Analysed", metrics.totalCompleted.toLocaleString(), "#0d9488")}
      ${kpiCard("Overall Avg Wait",      metrics.overallAvg + " min",            avgColor)}
      ${kpiCard("Busiest Hour",          metrics.peakHour,                        "#dc2626")}
      ${kpiCard("Quietest Hour",         metrics.quietHour,                       "#059669")}
      ${kpiCard("Longest Wait Day",      metrics.longestDay,                      "#d97706")}
      ${kpiCard("Shortest Wait Day",     metrics.shortestDay,                     "#059669")}
    </div>

    <div class="section">
      <h2>Average Wait Time by Hour of Day</h2>
      <table><thead><tr><th>Hour</th><th>Appointments</th><th style="width:220px">Avg Wait</th></tr></thead>
      <tbody>${todRows || '<tr><td colspan="3" style="color:#9ca3af;text-align:center">No data</td></tr>'}</tbody></table>
    </div>

    <div class="section">
      <h2>Average Wait Time by Date</h2>
      <table><thead><tr><th>Date</th><th>Appointments</th><th style="width:220px">Avg Wait</th></tr></thead>
      <tbody>${dateRows || '<tr><td colspan="3" style="color:#9ca3af;text-align:center">No data</td></tr>'}</tbody></table>
    </div>

    <div class="section">
      <h2>Average Wait Time by Service Type</h2>
      <table><thead><tr><th>Service</th><th>Appointments</th><th style="width:220px">Avg Wait</th></tr></thead>
      <tbody>${serviceRows || '<tr><td colspan="3" style="color:#9ca3af;text-align:center">No data</td></tr>'}</tbody></table>
    </div>

    <div class="section">
      <h2>Appointment Detail Log (most recent ${Math.min(appointments.length, 100)})</h2>
      <table><thead><tr><th>Date</th><th>Hour</th><th>Service</th><th>Duration (min)</th><th>Clinic</th><th>Band</th></tr></thead>
      <tbody>${apptRows || '<tr><td colspan="6" style="color:#9ca3af;text-align:center">No appointments in this period</td></tr>'}</tbody></table>
    </div>
  </body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  win.addEventListener("load", () => {
    win.document.title = `Wait Times Report ${new Date().toISOString().slice(0, 10)}.pdf`;
    win.focus();
    win.print();
  });
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// Main Load Function  (mirrors loadNoShowReport)
// ─────────────────────────────────────────────────────────────
export async function loadWaitTimeReport(range) {
  // 1. Verify user session
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    throw new Error("No active administrator session found. Please log in.");
  }

  // 2. Resolve clinicId via the server API — same pattern as adminDashboard.js.
  //    This is the reliable source because the profile is looked up across all
  //    role collections (patients / admins / staff / users) server-side.
  let clinicId = null;
  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch(
      `/api/user/login/${currentUser.uid}?email=${encodeURIComponent(currentUser.email || "")}`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );
    if (res.ok) {
      const data = await res.json();
      clinicId = data?.profile?.clinicId || null;
    }
  } catch (_) { /* fall through to Firestore fallback */ }

  // Firestore fallback: search admins → staff → users (mirrors SEARCH_COLLECTIONS server-side)
  if (!clinicId) {
    for (const col of ["admins", "staff", "users"]) {
      const doc = await db.collection(col).doc(currentUser.uid).get();
      if (doc.exists && doc.data().clinicId) {
        clinicId = doc.data().clinicId;
        break;
      }
    }
  }

  if (!clinicId) {
    throw new Error("No clinic linked to your account. Make sure you are logged in as a clinic admin.");
  }

  // 3. Query all non-cancelled appointments that have a serviceDuration.
  //    We do NOT filter by status === "completed" because most appointments
  //    stay as "booked" — serviceDuration is what signals a timed service.
  //    We exclude cancelled so we only count intended appointments.
  const snapshot = await db.collection("appointments")
    .where("clinicId", "==", clinicId)
    .get();

  // 4. Date filter in JS (avoids composite Firestore index requirement)
  const now = new Date();
  let cutoff = null;
  if (range === "7d")  cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  if (range === "30d") cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  if (range === "90d") cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
  if (range === "1y")  cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const raw = [];
  snapshot.forEach(doc => {
    const a = { id: doc.id, ...doc.data() };
    // Skip cancelled appointments and any without a serviceDuration
    if (a.status === "cancelled") return;
    if (typeof a.serviceDuration !== "number" || a.serviceDuration <= 0) return;
    if (cutoff) {
      const d = a.date?.toDate ? a.date.toDate() : new Date(a.date);
      if (d < cutoff) return;
    }
    raw.push(a);
  });

  const result = aggregateWaitData(raw);
  globalReportData = result;
  return result;
}

// ─────────────────────────────────────────────────────────────
// Aggregation Engine
// ─────────────────────────────────────────────────────────────
function aggregateWaitData(appointments) {
  const totalCompleted = appointments.length;

  // Sort newest first for table
  const sorted = [...appointments].sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date);
    const db_ = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    return db_ - da;
  });

  // Normalise date & timeSlot strings
  const normalised = sorted.map(a => ({
    ...a,
    date:     normaliseDate(a.date),
    timeSlot: a.timeSlot || "00:00",
  }));

  const overallAvg = totalCompleted > 0
    ? parseFloat((normalised.reduce((s, a) => s + a.serviceDuration, 0) / totalCompleted).toFixed(1))
    : 0;

  // ── By hour of day ──────────────────────────────────────────
  const hourMap = {};
  normalised.forEach(a => {
    const h = a.timeSlot.split(":")[0];
    if (!hourMap[h]) hourMap[h] = { timeSlot: h + ":00", count: 0, total: 0 };
    hourMap[h].count++;
    hourMap[h].total += a.serviceDuration;
  });
  const byTimeOfDay = Object.values(hourMap)
    .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
    .map(e => ({ timeSlot: e.timeSlot, appointmentsCompleted: e.count, avgWaitMinutes: parseFloat((e.total / e.count).toFixed(1)) }));

  // ── By date ─────────────────────────────────────────────────
  const dateMap = {};
  normalised.forEach(a => {
    if (!dateMap[a.date]) dateMap[a.date] = { date: a.date, count: 0, total: 0 };
    dateMap[a.date].count++;
    dateMap[a.date].total += a.serviceDuration;
  });
  const byDate = Object.values(dateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({ date: e.date, appointmentsCompleted: e.count, avgWaitMinutes: parseFloat((e.total / e.count).toFixed(1)) }));

  // ── By service name ─────────────────────────────────────────
  const serviceMap = {};
  normalised.forEach(a => {
    const name = a.serviceName || "Unknown Service";
    if (!serviceMap[name]) serviceMap[name] = { serviceName: name, count: 0, total: 0 };
    serviceMap[name].count++;
    serviceMap[name].total += a.serviceDuration;
  });
  const byService = Object.values(serviceMap)
    .map(e => ({ serviceName: e.serviceName, count: e.count, avgWaitMinutes: parseFloat((e.total / e.count).toFixed(1)) }))
    .sort((a, b) => b.avgWaitMinutes - a.avgWaitMinutes);

  // ── Peak/quiet hour ─────────────────────────────────────────
  let peakHour = "N/A", quietHour = "N/A";
  if (byTimeOfDay.length) {
    const sorted_ = [...byTimeOfDay].sort((a, b) => b.avgWaitMinutes - a.avgWaitMinutes);
    peakHour   = formatHour(sorted_[0].timeSlot);
    quietHour  = formatHour(sorted_[sorted_.length - 1].timeSlot);
  }

  // ── Longest/shortest wait day ────────────────────────────────
  let longestDay = "N/A", shortestDay = "N/A";
  if (byDate.length) {
    const sorted_ = [...byDate].sort((a, b) => b.avgWaitMinutes - a.avgWaitMinutes);
    longestDay  = new Date(sorted_[0].date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "2-digit", month: "short" });
    shortestDay = new Date(sorted_[sorted_.length - 1].date + "T00:00:00").toLocaleDateString("en-ZA", { weekday: "short", day: "2-digit", month: "short" });
  }

  return {
    metrics: { totalCompleted, overallAvg, peakHour, quietHour, longestDay, shortestDay },
    byTimeOfDay,
    byDate,
    byService,
    appointments: normalised,
  };
}

// ─────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────
function normaliseDate(raw) {
  if (!raw) return "";
  if (typeof raw.toDate === "function") return raw.toDate().toISOString().slice(0, 10);
  if (raw.seconds) return new Date(raw.seconds * 1000).toISOString().slice(0, 10);
  return String(raw).slice(0, 10);
}

function formatDate(dateStr) {
  if (!dateStr) return "–";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

function formatHour(timeSlot) {
  if (!timeSlot) return "–";
  const h = parseInt(timeSlot.split(":")[0]);
  if (isNaN(h)) return timeSlot;
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:00 ${suffix}`;
}

function escHtml(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

