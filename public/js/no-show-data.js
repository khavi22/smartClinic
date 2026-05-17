// ── FIREBASE LAYERING SIDE EFFECTS ───────────────────────────
import "./firebase-config.js"; 

// Data stash for running downloads
let globalReportData = null;

// Get the initialized global namespace context
const firebaseInstance = typeof firebase !== 'undefined' ? firebase : window.firebase;
const db = firebaseInstance.firestore();

// ─────────────────────────────────────────────────────────────
// Color Coding Metric Status Color
// ─────────────────────────────────────────────────────────────
function rateColor(r) {
  if (r >= 25) return "#ef4444";
  if (r >= 15) return "#f59e0b";
  return "#10b981";
}

// ─────────────────────────────────────────────────────────────
// Rendering Handlers
// ─────────────────────────────────────────────────────────────
function renderKPIs({ total, missed, noShowRate, avgPerDay, peakWeekday, recoveryRate }) {
  const items = [
    { label: "Total Appointments",  value: total.toLocaleString(), icon: "📅", color: "blue"  },
    { label: "Missed (No-Shows)",   value: missed.toLocaleString(), icon: "🚫", color: "red"   },
    { label: "No-Show Rate",        value: noShowRate + "%", icon: "📊",
      color: noShowRate > 20 ? "red" : noShowRate > 10 ? "amber" : "green" },
    { label: "Avg No-Shows / Day",  value: avgPerDay,    icon: "📆", color: "blue"  },
    { label: "Peak No-Show Day",    value: peakWeekday,  icon: "⚠️", color: "amber" },
    { label: "Rescheduled Rate",    value: recoveryRate + "%", icon: "🔄", color: "green" },
  ];

  document.getElementById("kpi-list").innerHTML = items.map(k => `
    <article class="kpi-card kpi-${k.color}" aria-label="${k.label}: ${k.value}">
      <span class="kpi-icon" aria-hidden="true">${k.icon}</span>
      <output class="kpi-value">${k.value}</output>
      <p class="kpi-label">${k.label}</p>
    </article>
  `).join("");
}

function renderTrendChart(trend) {
  const fig = document.getElementById("trend-chart");
  if (!trend.length) {
    fig.innerHTML = '<p class="empty-msg">No data for this period.</p>';
    return;
  }
  const max = Math.max(...trend.map(t => t.rate), 1);
  fig.innerHTML = `
    <figcaption class="sr-only">Bar chart: monthly no-show rate for the last 6 months.</figcaption>
    <ul class="bar-chart" role="list" aria-label="Monthly no-show rate">
      ${trend.map(t => `
        <li class="bar-group" aria-label="${t.label}: ${t.rate}% (${t.missed} of ${t.total})">
          <span class="bar-tooltip" role="tooltip">${t.missed} missed / ${t.total} total</span>
          <span class="bar-col" aria-hidden="true">
            <span class="bar-fill" style="height:${(t.rate / max) * 160}px">
              <span class="bar-val">${t.rate}%</span>
            </span>
          </span>
          <span class="bar-label"><time>${t.label}</time></span>
        </li>
      `).join("")}
    </ul>`;
}

function renderHBars(containerId, data, emptyMsg) {
  const el = document.getElementById(containerId);
  if (!data.length) {
    el.innerHTML = `<p class="empty-msg">${emptyMsg}</p>`;
    return;
  }
  el.innerHTML = `
    <dl class="h-bar-list">
      ${data.map(p => `
        <div class="h-bar-row">
          <dt class="h-bar-name" title="${p.name}">${p.name}</dt>
          <dd class="h-bar-meter">
            <meter min="0" max="100" value="${p.rate}"
              aria-label="${p.name}: ${p.rate}% no-show rate"
              style="--fill:${rateColor(p.rate)}"></meter>
          </dd>
          <dd class="h-bar-stat" aria-label="${p.missed} missed of ${p.total}">
            ${p.rate}%&nbsp;<span>(${p.missed}/${p.total})</span>
          </dd>
        </div>
      `).join("")}
    </dl>`;
}

function renderTable(rows) {
  const tbody = document.getElementById("missed-tbody");
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No missed appointments found.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.slice(0, 50).map(a => {
    const d       = getAppointmentDate(a);
    const dateStr = d ? d.toLocaleDateString("en-ZA", { day:"2-digit", month:"short", year:"numeric" }) : "–";
    const timeStr = d ? d.toLocaleTimeString("en-ZA", { hour:"2-digit", minute:"2-digit" }) : "–";
    const iso     = d ? d.toISOString() : "";
    return `<tr>
      <td><time datetime="${iso}">${dateStr}</time></td>
      <td><time datetime="${iso}">${timeStr}</time></td>
      <td>${a.patientName || a.patient?.name || "–"}</td>
      <td>${a.providerName || a.doctorName || a.provider || "–"}</td>
      <td>${a.appointmentType || a.type || a.serviceType || "–"}</td>
      <td><mark class="badge-missed" aria-label="Status: Missed">Missed</mark></td>
    </tr>`;
  }).join("");
}

// ─────────────────────────────────────────────────────────────
// Layout States Handler
// ─────────────────────────────────────────────────────────────
function showLoader(on) {
  document.getElementById("loader").hidden      = !on;
  document.getElementById("report-body").hidden =  on;
}

function showError(msg) {
  document.getElementById("loader").hidden      = true;
  document.getElementById("report-body").hidden = false;
  document.getElementById("report-body").innerHTML = `
    <p role="alert" class="error-box">
      <strong>Error loading data:</strong> ${msg}<br>
      <small>Check your Firebase configuration setup and your Firestore security rules.</small>
    </p>`;
}

// ─────────────────────────────────────────────────────────────
// Export Methods
// ─────────────────────────────────────────────────────────────
function exportCSV() {
  if (!globalReportData) return;

  const header = ["Date", "Time", "Patient", "Provider", "Type", "Status"];
  const lines  = globalReportData.missedAppointments.map(a => {
    const d = getAppointmentDate(a);
    return [
      d ? d.toLocaleDateString("en-ZA") : "",
      d ? d.toLocaleTimeString("en-ZA", { hour:"2-digit", minute:"2-digit" }) : "",
      a.patientName || a.patient?.name || "",
      a.providerName || a.doctorName || a.provider || "",
      a.appointmentType || a.type || a.serviceType || "",
      "Missed",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `no-show-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF() {
  window.print();
}

// ─────────────────────────────────────────────────────────────
// Date Formatter Conversion Helper
// ─────────────────────────────────────────────────────────────
export function getAppointmentDate(appointment) {
  if (!appointment || !appointment.date) return null;
  if (typeof appointment.date.toDate === 'function') {
    return appointment.date.toDate();
  }
  if (appointment.date.seconds) {
    return new Date(appointment.date.seconds * 1000);
  }
  return new Date(appointment.date);
}

export async function loadNoShowReport(range) {
  // 1. Ensure a user session is active from Firebase Auth
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    throw new Error("No active administrator session found. Please log in.");
  }

  // 2. Fetch the current logged-in user's profile data to find their clinic assignment
  // Admins are the primary users of this report; staff as fallback
  let clinicId = null;

  const adminDoc = await firebase.firestore().collection("admins").doc(currentUser.uid).get();
  if (adminDoc.exists) {
    clinicId = adminDoc.data().clinicId;
  } else {
    const staffDoc = await firebase.firestore().collection("staff").doc(currentUser.uid).get();
    if (staffDoc.exists) {
      clinicId = staffDoc.data().clinicId;
    }
  }

  if (!clinicId) {
    throw new Error("Make sure you are logged in with an account linked to an active clinic profile.");
  }

  // 3. Query appointments scoped to this clinicId only.
  // Date filtering is done in JS below to avoid requiring a composite Firestore index.
  const querySnapshot = await firebase.firestore()
    .collection("appointments")
    .where("clinicId", "==", clinicId)
    .get();

  const now = new Date();
  let cutoffDate = null;
  if (range === "7d")  cutoffDate = new Date(new Date().setDate(now.getDate() - 7));
  if (range === "30d") cutoffDate = new Date(new Date().setDate(now.getDate() - 30));
  if (range === "90d") cutoffDate = new Date(new Date().setDate(now.getDate() - 90));
  if (range === "1y")  cutoffDate = new Date(new Date().setFullYear(now.getFullYear() - 1));

  const rawAppointments = [];
  querySnapshot.forEach((doc) => {
    const appt = { id: doc.id, ...doc.data() };
    // Apply date filter in JS — avoids composite index requirement
    if (cutoffDate) {
      const apptDate = appt.date?.toDate ? appt.date.toDate() : new Date(appt.date);
      if (apptDate < cutoffDate) return;
    }
    rawAppointments.push(appt);
  });

  // Pass off to your math/aggregation logic engine
  return aggregateData(rawAppointments); 
}

// ─────────────────────────────────────────────────────────────
// Aggregation Math Logic Engine
// ─────────────────────────────────────────────────────────────
function aggregateData(appointments) {
  const total = appointments.length;
  const missedAppointments = appointments.filter(a => 
    a.status && (a.status.toLowerCase() === 'missed' || a.status.toLowerCase() === 'no-show')
  );
  const missed = missedAppointments.length;
  
  missedAppointments.sort((a, b) => getAppointmentDate(b) - getAppointmentDate(a));
  const noShowRate = total > 0 ? Math.round((missed / total) * 100) : 0;

  let rescheduledCount = 0;
  const patientsWhoMissed = new Set(missedAppointments.map(a => a.patientId || a.patientName));
  patientsWhoMissed.forEach(pKey => {
    const history = appointments.filter(a => (a.patientId === pKey || a.patientName === pKey));
    if (history.some(a => a.status?.toLowerCase() === 'missed') && 
        history.some(a => ['scheduled', 'completed', 'attended'].includes(a.status?.toLowerCase()))) {
      rescheduledCount++;
    }
  });
  const recoveryRate = patientsWhoMissed.size > 0 ? Math.round((rescheduledCount / patientsWhoMissed.size) * 100) : 0;

  const weekdayCounts = { 'Sunday':0, 'Monday':0, 'Tuesday':0, 'Wednesday':0, 'Thursday':0, 'Friday':0, 'Saturday':0 };
  const uniqueDaysWithMissed = new Set();
  const providersMap = {};
  const typesMap = {};
  const trendsMap = {};

  appointments.forEach(a => {
    const d = getAppointmentDate(a);
    if (!d) return;

    const isMissed = a.status && (a.status.toLowerCase() === 'missed' || a.status.toLowerCase() === 'no-show');
    const pName = a.providerName || a.doctorName || a.provider || "Unknown Provider";
    const tName = a.appointmentType || a.type || a.serviceType || "General Checkup";
    const monthLabel = d.toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });

    if (!trendsMap[monthLabel]) trendsMap[monthLabel] = { label: monthLabel, total: 0, missed: 0 };
    trendsMap[monthLabel].total++;
    if (isMissed) trendsMap[monthLabel].missed++;

    if (!providersMap[pName]) providersMap[pName] = { name: pName, total: 0, missed: 0 };
    providersMap[pName].total++;
    if (isMissed) providersMap[pName].missed++;

    if (!typesMap[tName]) typesMap[tName] = { name: tName, total: 0, missed: 0 };
    typesMap[tName].total++;
    if (isMissed) typesMap[tName].missed++;

    if (isMissed) {
      const dayName = d.toLocaleDateString("en-US", { weekday: 'long' });
      weekdayCounts[dayName]++;
      uniqueDaysWithMissed.add(d.toDateString());
    }
  });

  const byProvider = Object.values(providersMap).map(p => ({
    ...p, rate: p.total > 0 ? Math.round((p.missed / p.total) * 100) : 0
  })).sort((a,b) => b.rate - a.rate);

  const byType = Object.values(typesMap).map(t => ({
    ...t, rate: t.total > 0 ? Math.round((t.missed / t.total) * 100) : 0
  })).sort((a,b) => b.rate - a.rate);

  const monthlyTrend = Object.values(trendsMap).map(t => ({
    ...t, rate: t.total > 0 ? Math.round((t.missed / t.total) * 100) : 0
  }));

  let peakWeekday = "N/A";
  let maxDayCount = -1;
  for (const [day, count] of Object.entries(weekdayCounts)) {
    if (count > maxDayCount && count > 0) {
      maxDayCount = count;
      peakWeekday = day;
    }
  }

  const daysCount = uniqueDaysWithMissed.size || 1;
  const avgPerDay = parseFloat((missed / daysCount).toFixed(1));

  return { metrics: { total, missed, noShowRate, avgPerDay, peakWeekday, recoveryRate }, monthlyTrend, byProvider, byType, missedAppointments };
}

// Event bindings are handled by the auth-guarded DOMContentLoaded in noShowReport.html