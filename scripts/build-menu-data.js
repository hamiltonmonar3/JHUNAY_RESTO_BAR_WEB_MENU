const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const csvPath = path.join(root, 'Jhunay_Menú Detallado_Categoría.csv');
const csv = fs.readFileSync(csvPath, 'utf8');
const encoded = Buffer.from(csv, 'utf8').toString('base64');
const chunks = encoded.match(/.{1,1000}/g).map(chunk => `  ${JSON.stringify(chunk)}`).join(',\n');
const output = `window.JHUNAY_MENU_CSV = new TextDecoder().decode(Uint8Array.from(atob([\n${chunks}\n].join('')), character => character.charCodeAt(0)));\n`;

fs.writeFileSync(path.join(root, 'js', 'menu-data.js'), output, 'utf8');
console.log(`Generated menu data from ${csv.length} CSV characters.`);
