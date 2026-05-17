const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../public/adminDashboard.html');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const newSection = `        <!-- ── MANAGE CLINIC & SERVICES BUTTON ── -->
        <section class="admin-grid" style="margin-top: 32px; margin-bottom: 32px;">
            <article class="admin-card">
                <header class="card-header" style="display: flex; justify-content: space-between; align-items: center; border: none; padding-bottom: 0;">
                    <div style="display: flex; gap: 16px; align-items: center;">
                        <span class="card-icon"><i class='bx bx-clinic' aria-hidden="true"></i></span>
                        <div>
                            <h2 style="margin: 0; font-size: 1.25rem;">Clinic Settings &amp; Services</h2>
                            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 0.9rem;">Update facility details and manage bookable services</p>
                        </div>
                    </div>
                    <a href="manageservices.html" class="btn-save" style="text-decoration: none; display: inline-flex; align-items: center; gap: 8px; border-radius: 10px; font-weight: 600; padding: 10px 20px;">
                        <i class='bx bx-cog'></i> Manage Services
                    </a>
                </header>
            </article>
        </section>`;

let res = [];
for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    if (n >= 244 && n <= 418) {
        if (n === 244) {
            res.push(newSection);
        }
    } else if (n >= 447 && n <= 479) {
        // skip modal
    } else {
        res.push(lines[i]);
    }
}

fs.writeFileSync(filePath, res.join('\n'));
console.log('Successfully updated adminDashboard.html');
