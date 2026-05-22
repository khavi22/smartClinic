/**
 * Admin Onboarding Frontend
 * Support team portal to search clinics and send admin invitations
 */

class AdminOnboardingUI {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.loading = document.getElementById('loading');
        this.alertContainer = document.getElementById('alertContainer');
        this.selectedClinicSection = document.getElementById('selectedClinicSection');

        this.adminEmail = document.getElementById('adminEmail');
        this.sendInviteBtn = document.getElementById('sendInviteBtn');

        this.selectedClinic = null;

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.searchBtn.addEventListener('click', () => this.handleSearch());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        this.sendInviteBtn.addEventListener('click', () => this.handleSendInvite());
    }

    async handleSearch() {
        const query = this.searchInput.value.trim();

        if (!query) {
            this.showAlert('Please enter a clinic name', 'error');
            return;
        }

        this.showLoading(true);
        this.resultsContainer.innerHTML = '';

        try {
            // Get the Firebase ID token
            const user = firebase.auth().currentUser;
            if (!user) {
                const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `index.html?returnTo=${returnTo}`;
                return;
            }
            const token = await user.getIdToken();

            const response = await fetch('/api/admin-onboarding/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                    window.location.href = `index.html?returnTo=${returnTo}`;
                    return;
                }
                if (response.status === 403) {
                    throw new Error('Access denied. You do not have permission to perform this action.');
                }
                throw new Error('Failed to search clinics');
            }

            const data = await response.json();

            if (data.places && data.places.length > 0) {
                this.displayResults(data.places);
            } else {
                this.resultsContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">Search</div>
                        <p>No clinics found. Please try a different search term.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showAlert('Failed to search clinics: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayResults(places) {
        const resultsList = document.createElement('div');
        resultsList.className = 'results-list';

        places.forEach((place) => {
            const card = document.createElement('div');
            card.className = 'clinic-card';
            card.innerHTML = `
                <div class="clinic-name">${place.displayName.text}</div>
                <div class="clinic-address">${place.formattedAddress}</div>
                <div class="clinic-place-id">Place ID: ${place.id}</div>
            `;

            card.addEventListener('click', () => this.selectClinic(place));
            resultsList.appendChild(card);
        });

        this.resultsContainer.innerHTML = '';
        this.resultsContainer.appendChild(resultsList);
    }

    async selectClinic(place) {
        this.selectedClinic = place;

        // Update form display
        document.getElementById('displayClinicName').textContent = place.displayName.text;
        document.getElementById('displayClinicAddress').textContent = place.formattedAddress;

        // Fetch clinic admin code
        try {
            // Get the Firebase ID token
            const user = firebase.auth().currentUser;
            if (!user) {
                const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `index.html?returnTo=${returnTo}`;
                return;
            }
            const token = await user.getIdToken();

            const response = await fetch('/api/admin-onboarding/clinic-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ placeId: place.id })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                    window.location.href = `index.html?returnTo=${returnTo}`;
                    return;
                }
                if (response.status === 403) {
                    throw new Error('Access denied. You do not have permission to perform this action.');
                }
                throw new Error('Failed to fetch clinic code');
            }

            const data = await response.json();
            document.getElementById('displayAdminCode').textContent = data.adminCode;

            // Show the selected clinic section
            this.selectedClinicSection.style.display = 'block';

            // Reset form
            this.adminEmail.value = '';

            // Scroll to the form
            setTimeout(() => {
                this.selectedClinicSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } catch (error) {
            console.error('Error fetching clinic code:', error);
            this.showAlert('Failed to fetch clinic details: ' + error.message, 'error');
        }
    }

    async handleSendInvite() {
        const email = this.adminEmail.value.trim();

        if (!email) {
            this.showAlert('Please fill in the email address', 'error');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showAlert('Please enter a valid email address', 'error');
            return;
        }

        if (!this.selectedClinic) {
            this.showAlert('No clinic selected', 'error');
            return;
        }

        // Disable button and show inline spinner while request is in flight
        this.sendInviteBtn.disabled = true;
        this.sendInviteBtn.innerHTML = `
            <div class="spinner" style="
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid #f3f4f6;
                border-top: 2px solid white;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-right: 8px;
                vertical-align: middle;
            "></div>Sending...
        `;

        try {
            // Get the Firebase ID token
            const user = firebase.auth().currentUser;
            if (!user) {
                const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                window.location.href = `index.html?returnTo=${returnTo}`;
                return;
            }
            const token = await user.getIdToken();

            // Trim to remove any whitespace textContent may have picked up
            const adminCode = document.getElementById('displayAdminCode').textContent.trim();

            // Guard against a missing admin code before hitting the network
            if (!adminCode) {
                throw new Error('Admin code is missing. Please re-select the clinic and try again.');
            }

            const payload = {
                adminEmail: email,
                clinicId: this.selectedClinic.id,
                clinicName: this.selectedClinic.displayName.text,
                clinicAddress: this.selectedClinic.formattedAddress,
                adminCode: adminCode
            };

            console.log('Sending invite payload:', {
                ...payload,
                adminEmail: payload.adminEmail.substring(0, 3) + '...'
            });

            const response = await fetch('/api/admin-onboarding/send-invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                // Handle auth failures
                if (response.status === 401) {
                    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                    window.location.href = `index.html?returnTo=${returnTo}`;
                    return;
                }
                if (response.status === 403) {
                    throw new Error('Access denied. You do not have permission to perform this action.');
                }
                
                // Parse the backend error body to get the exact validation message
                let errorMessage = 'Failed to send invitation';
                try {
                    const errorData = await response.json();
                    if (errorData.errors && errorData.errors.length > 0) {
                        // Backend sends an errors array for validation failures
                        errorMessage = errorData.errors.join(', ');
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (parseError) {
                    // Response body was not JSON, fall back to status text
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            this.showAlert(
                'Invitation sent to ' + email + '. Admin code and clinic details have been sent.',
                'success'
            );

            // Call the global clearSelection function, not a class method
            setTimeout(() => {
                clearSelection();
            }, 2000);
        } catch (error) {
            console.error('Send invite error:', error);
            this.showAlert('Failed to send invitation: ' + error.message, 'error');
        } finally {
            // Use innerHTML to match how the button content was originally set
            this.sendInviteBtn.disabled = false;
            this.sendInviteBtn.innerHTML = 'Send Invitation';
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showLoading(show) {
        if (show) {
            this.loading.classList.add('show');
        } else {
            this.loading.classList.remove('show');
        }
    }

    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} show`;
        alert.textContent = message;

        this.alertContainer.innerHTML = '';
        this.alertContainer.appendChild(alert);

        // Auto-dismiss after 5 seconds for success alerts
        if (type === 'success') {
            setTimeout(() => {
                alert.classList.remove('show');
            }, 5000);
        }
    }
}

// Global function accessed by the Cancel button via onclick and by clearSelection calls
function clearSelection() {
    const ui = window.adminOnboardingUI;

    if (!ui) {
        console.error('AdminOnboardingUI instance not found on window');
        return;
    }

    ui.selectedClinic = null;
    ui.selectedClinicSection.style.display = 'none';
    ui.resultsContainer.innerHTML = '';
    ui.searchInput.value = '';
    ui.adminEmail.value = '';
}

// Global function used by the Copy button in the admin code display row
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);

    if (!element) {
        console.error('Element not found for clipboard copy: ' + elementId);
        return;
    }

    const text = element.textContent;

    navigator.clipboard.writeText(text).then(() => {
        // event.target refers to the button that triggered the onclick
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch((err) => {
        console.error('Failed to copy to clipboard:', err);
    });
}

// Initialize the UI once auth check has passed and DOM is fully loaded
function initializeAdminOnboardingUI() {
    if (!window.adminOnboardingUI) {
        window.adminOnboardingUI = new AdminOnboardingUI();
        console.log("AdminOnboardingUI instance created and stored on window");
    }
}

// Also initialize on DOMContentLoaded if auth already checked
document.addEventListener('DOMContentLoaded', () => {
    // Check if main content is already visible (auth passed)
    const mainContent = document.getElementById('mainContent');
    if (mainContent && mainContent.style.display !== 'none') {
        initializeAdminOnboardingUI();
    }
});