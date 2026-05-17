const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../public/js/manageservices.js');
let jsContent = fs.readFileSync(jsPath, 'utf8');
jsContent = jsContent.replace(/14px 18px/g, '20px 24px');
fs.writeFileSync(jsPath, jsContent);

const htmlPath = path.join(__dirname, '../public/manageservices.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');
htmlContent = htmlContent.replace(/padding: 14px 18px/g, 'padding: 20px 24px');
htmlContent = htmlContent.replace(/gap: 16px; margin-top: 12px;/g, 'gap: 24px; margin-top: 20px;');
htmlContent = htmlContent.replace(/margin-bottom: 16px;/g, 'margin-bottom: 24px;');
fs.writeFileSync(htmlPath, htmlContent);

console.log('UI Spacing Improved');
