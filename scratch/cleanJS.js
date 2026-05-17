const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/js/adminDashboard.js');
let content = fs.readFileSync(filePath, 'utf8');

// Remove the load function calls from the auth block
content = content.replace(/await loadClinicProfile\(currentClinicId\);\s+await loadTemplates\(\);\s+await loadServices\(\);/, '');

// Find where profile form starts
const profileFormStart = content.indexOf('const profileForm = document.getElementById("profileForm");');
if (profileFormStart !== -1) {
    content = content.substring(0, profileFormStart);
}

fs.writeFileSync(filePath, content);
console.log('Successfully updated adminDashboard.js');
