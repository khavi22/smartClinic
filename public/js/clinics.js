// clinics.js — v3: Firestore-based clinic filtering
const search_button_ByName     = document.getElementById("Butt_SearchByName");
const search_button_ByLocation = document.getElementById("Butt_UseLocation");
const section_view_clinics     = document.getElementById("search_clinic_section");
const results_count_display    = document.getElementById("resultsCountDisplay");

// ── Filter toggle ────────────────────────────────────────────────────────────
const filterToggle = document.getElementById("filterToggleBtn");
const filterBody   = document.getElementById("filterBody");

if (filterToggle && filterBody) {

    filterToggle.addEventListener("click", () => {
        const expanded =
            filterToggle.getAttribute("aria-expanded") === "true";

        filterToggle.setAttribute(
            "aria-expanded",
            String(!expanded)
        );

        filterBody.hidden = expanded;
    });

    filterToggle.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            filterToggle.click();
        }
    });
}

// ── Collect active filter values ─────────────────────────────────────────────
function getFilters() {
    const facilityType =
    document.querySelector('input[name="facilityTypeFilter"]:checked')?.value || "";
    const province     = document.getElementById("filterProvince").value.trim();
    const district     = document.getElementById("filterDistrict").value.trim().toLowerCase();
    const region       = document.getElementById("filterRegion").value.trim().toLowerCase();
    const services     = [...document.querySelectorAll("#servicesChipList input:checked")]
                            .map(cb => cb.value);
    return { facilityType, province, district, region, services };
}

function countFilters(f) {
    return (f.facilityType ? 1 : 0) + (f.province ? 1 : 0) +
           (f.district ? 1 : 0) + (f.region ? 1 : 0) + f.services.length;
}

function updateFilterBadge() {
    const badge = document.getElementById("filterBadge");
    const n = countFilters(getFilters());
    badge.textContent = n;
    badge.hidden = n === 0;
}

if (filterBody) {

    document.querySelectorAll("#filterBody select")
        .forEach(el => {
            el.addEventListener("change", updateFilterBadge);
        });

    document.querySelectorAll("#filterBody input[type=text]")
        .forEach(el => {
            el.addEventListener("input", updateFilterBadge);
        });
}
document.querySelectorAll('input[name="facilityTypeFilter"]').forEach(el => {el.addEventListener("change", updateFilterBadge);});

document.querySelectorAll('#servicesChipList input').forEach(el => {el.addEventListener("change", updateFilterBadge);
});

// ── Clear filters ─────────────────────────────────────────────────────────────
const clearFiltersBtn =
    document.getElementById("clearFiltersBtn");

if (clearFiltersBtn) {

    clearFiltersBtn.addEventListener("click", () => {

        document.getElementById("filterFacilityType").value = "";
        document.getElementById("filterProvince").value = "";
        document.getElementById("filterDistrict").value = "";
        document.getElementById("filterRegion").value = "";

        document.querySelectorAll("#servicesChipList input")
            .forEach(cb => {
                cb.checked = false;
            });

        updateFilterBadge();
    });
}

// ── Render active filter tags above results ───────────────────────────────────
function renderActiveFilterTags(filters) {
    const existing = document.getElementById("activeFiltersRow");
    if (existing) existing.remove();

    const tags = [];
    if (filters.facilityType) tags.push({ label: filters.facilityType, field: "filterFacilityType", type: "select" });
    if (filters.province)     tags.push({ label: filters.province,     field: "filterProvince",     type: "select" });
    if (filters.district)     tags.push({ label: filters.district,     field: "filterDistrict",     type: "text" });
    if (filters.region)       tags.push({ label: filters.region,       field: "filterRegion",       type: "text" });
    filters.services.forEach(s => tags.push({ label: s, type: "service", value: s }));

    if (!tags.length) return;

    const row = document.createElement("div");
    row.id = "activeFiltersRow";
    row.className = "active-filters-row";

    tags.forEach(tag => {
        const el = document.createElement("span");
        el.className = "active-filter-tag";
        el.innerHTML = `${tag.label} <button aria-label="Remove filter">&times;</button>`;
        el.querySelector("button").addEventListener("click", () => {
            if (tag.type === "select") { document.getElementById(tag.field).value = ""; }
            else if (tag.type === "text") { document.getElementById(tag.field).value = ""; }
            else if (tag.type === "service") {
                const cb = [...document.querySelectorAll("#servicesChipList input")]
                    .find(c => c.value === tag.value);
                if (cb) cb.checked = false;
            }
            updateFilterBadge();
        });
        row.appendChild(el);
    });

    const header = document.querySelector(".slots-header");
    header.after(row);
}

// ── Firestore query with filters ─────────────────────────────────────────────
async function searchFirestoreClinics(filters) {
    const db = firebase.firestore();
    let query = db.collection("clinics");
    //query = query.where("isActive", "==", true);
    if (filters.facilityType) {
        query = query.where("facilityType", "==", filters.facilityType);
    }
    if (filters.province) {
        query = query.where("province", "==", filters.province);
    }

    const snapshot = await query.get();
    let clinics = [];

    snapshot.forEach(doc => {
        clinics.push({ id: doc.id, ...doc.data() });
    });

    // Client-side filtering for text fields and services
    if (filters.district) {
        clinics = clinics.filter(c =>
            c.district && c.district.toLowerCase().includes(filters.district)
        );
    }
    if (filters.region) {
        clinics = clinics.filter(c =>
            c.region && c.region.toLowerCase().includes(filters.region)
        );
    }
    if (filters.services.length > 0) {
        clinics = clinics.filter(c =>
            c.services && filters.services.every(s => c.services.includes(s))
        );
    }

    return clinics;
}

// ── Render from Firestore ─────────────────────────────────────────────────────
function renderFirestoreClinics(clinicsArray) {
    section_view_clinics.innerHTML = "";

    if (!clinicsArray || clinicsArray.length === 0) {
        section_view_clinics.innerHTML = `
            <article class="empty-state">
                <p>No clinics match your filters. Try adjusting your criteria.</p>
            </article>`;
        results_count_display.textContent = "0 results found";
        return;
    }

    results_count_display.textContent = `${clinicsArray.length} result${clinicsArray.length !== 1 ? "s" : ""} found`;

    clinicsArray.forEach(clinic => {
        const name    = clinic.clinicName || clinic.name || "Unnamed Clinic";
        const address = clinic.address || "Address not available";
        const tags    = [];

        if (clinic.facilityType) tags.push(`<span class="clinic-tag facility">${clinic.facilityType}</span>`);
        const loc = [clinic.region, clinic.district, clinic.province].filter(Boolean).join(", ");
        if (loc) tags.push(`<span class="clinic-tag location">${loc}</span>`);

        const card = document.createElement("article");
        card.classList.add("clinic-result-card");
        card.innerHTML = `
            <section class="clinic-info">
                <h2 class="clinic-name">${name}</h2>
                <p class="clinic-address-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top:2px;flex-shrink:0">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>${address}</span>
                </p>
                ${tags.length ? `<div class="clinic-tags">${tags.join("")}</div>` : ""}
            </section>
            <section class="clinic-action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </section>`;

        card.addEventListener("click", () => {
            const url = `Availability.html?id=${encodeURIComponent(clinic.id)}&name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}`;
            window.location.href = url;
        });

        section_view_clinics.appendChild(card);
    });
}

// ── Render from Google Places API ────────────────────────────────────────────
function renderPlacesClinics(clinicsArray) {
    section_view_clinics.innerHTML = "";

    if (!clinicsArray || clinicsArray.length === 0) {
        section_view_clinics.innerHTML = `<article class="empty-state"><p>No clinics found. Try a different area or name.</p></article>`;
        results_count_display.textContent = "0 results found";
        return;
    }

    results_count_display.textContent = `${clinicsArray.length} result${clinicsArray.length !== 1 ? "s" : ""} found`;

    clinicsArray.forEach(clinic => {
        const clinicName    = clinic.displayName.text;
        const clinicAddress = clinic.formattedAddress || "Address not available";

        const card = document.createElement("article");
        card.classList.add("clinic-result-card");
        card.innerHTML = `
            <section class="clinic-info">
                <h2 class="clinic-name">${clinicName}</h2>
                <p class="clinic-address-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top:2px;flex-shrink:0">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>${clinicAddress}</span>
                </p>
            </section>
            <section class="clinic-action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </section>`;

        card.addEventListener("click", () => {
            const clinicId = clinic.id || "default_clinic";
            const url = `Availability.html?id=${encodeURIComponent(clinicId)}&name=${encodeURIComponent(clinicName)}&address=${encodeURIComponent(clinicAddress)}`;
            window.location.href = url;
        });

        section_view_clinics.appendChild(card);
    });
}

// ── Apply Filters ─────────────────────────────────────────────────────────────
const applyFiltersBtn =
    document.getElementById("applyFiltersBtn");

if (applyFiltersBtn) {

    applyFiltersBtn.addEventListener("click", async () => {

        const filters = getFilters();

        if (countFilters(filters) === 0) {

            section_view_clinics.innerHTML = `
                <article class="empty-state">
                    <p>
                        Select at least one filter
                        and click Apply Filters.
                    </p>
                </article>
            `;

            results_count_display.textContent =
                "No search performed";

            return;
        }

        section_view_clinics.innerHTML = `
            <article class="empty-state">
                <p>Searching...</p>
            </article>
        `;

        results_count_display.textContent = "Searching…";

        try {

            const clinics =
                await searchFirestoreClinics(filters);

            renderActiveFilterTags(filters);

            renderFirestoreClinics(clinics);

        } catch (err) {

            console.error("Filter search error:", err);

            section_view_clinics.innerHTML = `
                <article
                    class="empty-state"
                    style="color:#ef4444"
                >
                    <p>
                        Failed to apply filters.
                        Please try again.
                    </p>
                </article>
            `;
        }
    });
}

// ── Search by Name ────────────────────────────────────────────────────────────
search_button_ByName.addEventListener("click", async function () {
    const search_input = document.getElementById("search_input");
    const input_value  = search_input.value.trim();
    if (!input_value) return;

    section_view_clinics.innerHTML = `<article class="empty-state"><p>Searching for "${input_value}"...</p></article>`;

    try {
        const response = await fetch(`/api/clinics?search=${encodeURIComponent(input_value)}`);
        const data     = await response.json();
        const existing = document.getElementById("activeFiltersRow");
        if (existing) existing.remove();
        renderPlacesClinics(data.places);
        search_input.value = "";
    } catch (error) {
        console.error("Error fetching clinics:", error);
        section_view_clinics.innerHTML = `<article class="empty-state" style="color:#ef4444"><p>Failed to load clinics. Please try again later.</p></article>`;
    }
});

// ── Search by Location ────────────────────────────────────────────────────────
search_button_ByLocation.addEventListener("click", async function () {
    if (!navigator.geolocation) { alert("Geolocation is not supported by your browser"); return; }

    section_view_clinics.innerHTML = `<article class="empty-state"><p>Requesting location access...</p></article>`;

    navigator.geolocation.getCurrentPosition(async function (position) {
        section_view_clinics.innerHTML = `<article class="empty-state"><p>Searching for clinics near you...</p></article>`;
        try {
            const response = await fetch(`/api/clinics?lat=${position.coords.latitude}&lon=${position.coords.longitude}`);
            const data     = await response.json();
            const existing = document.getElementById("activeFiltersRow");
            if (existing) existing.remove();
            renderPlacesClinics(data.places);
        } catch (error) {
            section_view_clinics.innerHTML = `<article class="empty-state" style="color:#ef4444"><p>Failed to load nearby clinics.</p></article>`;
        }
    }, function () {
        section_view_clinics.innerHTML = `<article class="empty-state" style="color:#ef4444"><p>Location access denied or unavailable.</p></article>`;
    });
});
