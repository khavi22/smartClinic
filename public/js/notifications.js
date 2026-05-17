/**
 * Notification System for SmartClinic
 * Replaces native alert() with beautiful toast notifications.
 */

(function() {
    // Create container if it doesn't exist
    function ensureContainer() {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', or 'info' (default: 'info')
     * @param {number} duration - Time in ms before auto-closing (default: 5000)
     */
    window.showToast = function(message, type = 'info', duration = 5000) {
        const container = ensureContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? '✓' : (type === 'error' ? '✕' : 'ℹ');
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">${message}</div>
            <button class="toast-close">&times;</button>
        `;
        
        container.appendChild(toast);
        
        const closeBtn = toast.querySelector('.toast-close');
        
        const removeToast = () => {
            if (toast.classList.contains('hiding')) return;
            toast.classList.add('hiding');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 400); // Match animation duration
        };
        
        closeBtn.onclick = removeToast;
        
        if (duration > 0) {
            setTimeout(removeToast, duration);
        }
    };

    // Override native alert (Optional, but safer for existing code)
    // window.alert = function(message) {
    //     window.showToast(message, 'info');
    // };
})();
