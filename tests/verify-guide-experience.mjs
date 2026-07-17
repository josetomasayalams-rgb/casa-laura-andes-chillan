import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const fail = (message) => { console.error(`  FAIL: ${message}`); process.exitCode = 1; };
const html = read('cerca-de-mi.html');
const nearby = read('js/nearby.js');
const styles = read('css/styles.css');
const lang = read('js/lang.js');
const theme = read('js/theme.js');
const catalog = read('js/catalog-guide.js');

if (!/id="guide-map-toggle"[^>]*aria-expanded="true"[^>]*aria-controls="guide-map-shell"/.test(html) ||
    !/id="guide-map-shell"/.test(html)) {
  fail('map toggle must expose aria-expanded and aria-controls');
}
if (!nearby.includes("sessionStorage.setItem(MAP_VISIBILITY_KEY") ||
    !nearby.includes("sessionStorage.getItem(MAP_VISIBILITY_KEY") ||
    !nearby.includes("mapShell.hidden = !mapVisible") ||
    !nearby.includes("layout.setAttribute('data-map-visible'") ||
    !nearby.includes("mapToggle.setAttribute('aria-expanded'")) {
  fail('map visibility must be session-only, accessible and remove the map from layout');
}
if (!html.includes('id="guide-results-region"') || !html.includes('aria-busy="true"') ||
    !html.includes('id="nearby-loading"') ||
    !nearby.includes("resultsRegion.setAttribute('aria-busy', 'false')") ||
    !nearby.includes("empty.textContent = t('guide.loadError')")) {
  fail('loading and error states must be explicit and announced');
}
if (!styles.includes('.guide-layout[data-map-visible="false"]') ||
    !styles.includes('.guide-layout[data-map-visible="false"] .nearby-grid') ||
    !styles.includes('.guide-map-shell[hidden]')) {
  fail('hidden map must reflow the results list to full width');
}
if (html.includes('nearby-emergency') || html.includes('nearby.emergency') || lang.includes("'nearby.emergency'")) {
  fail('the emergency strip must be absent from Explore the Valley only');
}
if (!styles.includes('body[data-section="nearby"] .guide-hero::before') ||
    !styles.includes('body[data-section="nearby"] .guide-hero::after') ||
    !styles.includes('content: none !important')) {
  fail('nearby hero decorative bands must be disabled');
}
for (const key of ['guide.map.show', 'guide.map.hide', 'guide.action.instagram']) {
  if ((lang.match(new RegExp(`'${key.replaceAll('.', '\\.')}':`, 'g')) || []).length !== 3) fail(`${key} must exist in ES/PT/EN`);
}
if (!lang.includes("querySelectorAll('.lang-selector')") || !lang.includes("new CustomEvent('cordal:language-changed'")) {
  fail('language selector must update every visible control and announce one change');
}
if (theme.includes('GH_I18N.apply(') || !theme.includes("GH_I18N.subscribe(localizeControl)")) {
  fail('theme control must localize without reapplying the whole page');
}
if (!catalog.includes('GH_I18N.subscribe(update)') || catalog.includes("addEventListener('gh:language-changed'")) {
  fail('catalog language updates must use one shared subscriber');
}
for (const page of ['actividades.html', 'restaurantes.html']) {
  const source = read(page);
  const iconLinks = [...source.matchAll(/<a class="catalog-action[^>]+>.*?<\/a>/g)];
  if (!iconLinks.length || iconLinks.some(([link]) => !/aria-label="[^"]+"/.test(link) || !/data-i18n-aria="[^"]+"/.test(link) || !/<span class="action-icon action-icon--[a-z-]+" aria-hidden="true"/.test(link))) {
    fail(`${page}: every icon action needs a localized accessible name and a decorative local theme-aware icon`);
  }
  if (/data-category="(?:hotel|cabin)"/.test(source)) fail(`${page}: lodging leaked into the canonical catalog`);
  if (/class="catalog-sources"|>Fuentes<|>Fontes<|>Sources</.test(source)) fail(`${page}: editorial provenance must not appear in the guest catalog`);
}
if (/[🔑📍🍽️🚵❄️🎿🚙📖🩹🚪]/u.test(read('index.html'))) fail('home section icons must use theme-aware SVG instead of emoji');
if (!read('index.html').includes('class="card nearby-home-card') || !read('index.html').includes('Restaurantes, panoramas y servicios cercanos')) {
  fail('home must present Explore the Valley as a featured, descriptive entry');
}
if (!theme.includes("classList.add('preference-bar')") || !styles.includes('.preference-bar .theme-selector')) {
  fail('language and theme must share one reusable preference bar');
}
if (nearby.includes('guide-place__sources') || nearby.includes('<b>Google ') || nearby.includes('<b>Tripadvisor ')) {
  fail('nearby cards must keep provenance internal and show a compact provider-neutral rating');
}
if (nearby.includes('duplicatesMerged') || nearby.includes('guide.quality.providers') || html.includes('id="guide-quality"')) {
  fail('guest UI must not expose provider or deduplication metadata');
}
if (!styles.includes('.action-icon') || !styles.includes('.catalog-action--maps { width: 44px')) {
  fail('external actions must use compact theme-aware icons instead of a Maps wordmark');
}
for (const asset of ['navigation', 'google-maps', 'website', 'instagram', 'phone']) {
  if (!styles.includes(`../assets/icons/${asset}.svg`)) fail(`theme-aware action icon mapping missing: ${asset}`);
}

if (!process.exitCode) console.log('  PASS (premium icons, unified preferences, private provenance, responsive guide actions)');
