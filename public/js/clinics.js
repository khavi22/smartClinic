const search_button_ByName = document.getElementById("Butt_SearchByName");
const search_button_ByLocation = document.getElementById("Butt_UseLocation");
const section_view_clinics = document.getElementById("search_clinic_section");
const results_count_display = document.getElementById("resultsCountDisplay");

// show returned clinics
function renderClinics(clinicsArray) {
    section_view_clinics.innerHTML = "";

    if (!clinicsArray || clinicsArray.length === 0) {
        section_view_clinics.innerHTML = `
            <article class="empty-state">
                <p>No clinics found. Try a different area or name.</p>
            </article>
        `;
        results_count_display.textContent = "0 results found";
        return;
    }

    results_count_display.textContent = `${clinicsArray.length} result${clinicsArray.length !== 1 ? 's' : ''} found`;

    clinicsArray.forEach(clinic => {
        const clinicName = clinic.displayName.text;
        const clinicAddress = clinic.formattedAddress || "Address not available";

        const card = document.createElement("article");
        card.classList.add("clinic-result-card");
        card.innerHTML = `
            <section class="clinic-info">
                <h2 class="clinic-name">${clinicName}</h2>
                <p class="clinic-address-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-top: 2px; flex-shrink: 0;">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>${clinicAddress}</span>
                </p>
            </section>
            <section class="clinic-action-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </section>
        `;

        // Click handler to navigate to Availability with URL params!
        card.addEventListener("click", () => {
            const clinicId = clinic.id || "default_clinic";
            const url = `Availability.html?id=${encodeURIComponent(clinicId)}&name=${encodeURIComponent(clinicName)}&address=${encodeURIComponent(clinicAddress)}`;
            window.location.href = url;
        });

        section_view_clinics.appendChild(card);
    });
}

search_button_ByName.addEventListener("click", async function () {
    const search_input = document.getElementById("search_input");
    const input_value = search_input.value.trim();

    if (!input_value) return;

    // Show loading state
    section_view_clinics.innerHTML = `
        <article class="empty-state">
            <p>Searching for "${input_value}"...</p>
        </article>
    `;

    try {
        const response = await fetch(`http://localhost:3000/api/clinics?search=${encodeURIComponent(input_value)}`);
        const data = await response.json();
        renderClinics(data.places);
        search_input.value = "";
    } catch (error) {
        console.error("Error fetching clinics:", error);
        section_view_clinics.innerHTML = `
            <article class="empty-state" style="color: #ef4444;">
                <p>Failed to load clinics. Please try again later.</p>
            </article>
        `;
    }
});

search_button_ByLocation.addEventListener("click", async function () {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    section_view_clinics.innerHTML = `
        <article class="empty-state">
            <p>Requesting location access...</p>
        </article>
    `;

    navigator.geolocation.getCurrentPosition(async function (position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        section_view_clinics.innerHTML = `
            <article class="empty-state">
                <p>Searching for clinics near you...</p>
            </article>
        `;

        try {
            const response = await fetch(`http://localhost:3000/api/clinics?lat=${latitude}&lon=${longitude}`);
            const data = await response.json()
            renderClinics(data.places);
        } catch (error) {
            console.error("Error fetching nearest clinics:", error);
            section_view_clinics.innerHTML = `
                <article class="empty-state" style="color: #ef4444;">
                    <p>Failed to load nearby clinics.</p>
                </article>
            `;
        }
    }, function () {
        section_view_clinics.innerHTML = `
            <article class="empty-state" style="color: #ef4444;">
                <p>Location access denied or unavailable.</p>
            </article>
        `;
    });
});
