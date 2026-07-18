import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const fail = (message) => { console.error(`  FAIL: ${message}`); process.exitCode = 1; };

const hostData = JSON.parse(read('data/host-data.json'));
const climate = read('clima.html');
const tickets = read('tickets.html');
const checkin = read('check-in.html');
const styles = read('css/styles.css');
const lang = read('js/lang.js');

const expectedUrls = {
  'clima.forecast': 'https://es.snow-forecast.com/resorts/Chillan/6day/bot',
  'clima.cameras': 'https://www.nevadosdechillan.com/camaras',
  'clima.mountainReport': 'https://www.nevadosdechillan.com/reporte-montana',
  'tickets.buy': 'https://www.skipassnevadosdechillan.com/tienda/',
  'tickets.mountainReport': 'https://www.nevadosdechillan.com/reporte-montana'
};

for (const [key, url] of Object.entries(expectedUrls)) {
  if (hostData.urls?.[key] !== url) fail(`data.urls.${key} must use the verified destination`);
  const page = key.startsWith('clima.') ? climate : tickets;
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const link = page.match(new RegExp(`<a\\b[^>]*href="${escaped}"[^>]*>`))?.[0] || '';
  if (!link.includes('target="_blank"') || !link.includes('rel="noopener noreferrer"')) {
    fail(`${key} must open safely in a new tab`);
  }
}

for (const key of [
  'clima.fc.cameras.title', 'clima.fc.cameras.subtitle', 'clima.fc.cameras.cta',
  'clima.fc.report.title', 'clima.fc.report.subtitle', 'clima.fc.report.cta',
  'tickets.pass.price', 'tickets.pass.note', 'tickets.buy.title',
  'tickets.buy.detail', 'tickets.buy.cta', 'tickets.report.title',
  'tickets.report.detail', 'tickets.report.cta', 'checkin.parking.tag',
  'checkin.parking.title', 'checkin.parking.body'
]) {
  const matches = lang.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) || [];
  if (matches.length !== 3) fail(`${key} must exist once in ES, PT and EN`);
}

if (hostData.scalar?.['tickets.pass.price']?.es !== 'Desde $65.000' ||
    !tickets.includes('data-i18n="tickets.pass.price"') ||
    !tickets.includes('data-i18n="tickets.pass.note"')) {
  fail('the day-pass card must show the verified reference price and date disclaimer');
}

if (!checkin.includes('DEPTO-34') ||
    !checkin.includes('data-i18n="checkin.parking.body"') ||
    !hostData.scalar?.['checkin.parking.body']?.es.includes('mano izquierda')) {
  fail('Check-in must identify underground parking DEPTO-34 beside the left side of the access stairs');
}

for (const asset of ['camera.svg', 'mountain-snow.svg', 'ticket.svg']) {
  if (!fs.existsSync(path.join(ROOT, 'assets/icons', asset))) fail(`missing mountain resource icon ${asset}`);
}

if (!/\.preference-bar,[\s\S]*?border-radius:\s*999px;[\s\S]*?clip-path:\s*inset\(0 round 999px\)/.test(styles) ||
    !/body\[data-section="home"\] \.top-controls\.preference-bar\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?clip-path:\s*inset\(0 round 999px\)/.test(styles)) {
  fail('the preference panel must clip all four corners to a fully rounded shape');
}
if (!/\.theme-selector button,[\s\S]*?display:\s*grid;[\s\S]*?place-items:\s*center;[\s\S]*?padding:\s*0;/.test(styles) ||
    !/\.theme-selector__icon\s*\{[\s\S]*?display:\s*block;/.test(styles)) {
  fail('sun and moon controls must center their icons geometrically');
}
if (!styles.includes('--ui-surface-raised: rgba(255, 253, 247, .975)') ||
    !styles.includes('--ui-surface-raised: rgba(12, 37, 31, .97)')) {
  fail('preference surface must remain ivory in light mode and green in dark mode');
}

if (!process.exitCode) console.log('  PASS (preferences, mountain links, ski pass and DEPTO-34 parking)');
