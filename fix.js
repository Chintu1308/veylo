const fs = require('fs');
const path = 'apps/web/src/pages/DevicesPage.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  'export API_BASE="\\${API_BASE:-https://veylo-api.onrender.com}"',
  'export API_BASE="\\${API_BASE:-' + '$' + '{API_BASE}}"'
);
fs.writeFileSync(path, content);
