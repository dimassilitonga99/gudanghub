// Debug auto-logout cabang: pantau SEMUA request/respons berkode AUTH_REQUIRED
import { chromium } from 'playwright-core';

const BASE = process.env.TEST_BASE || 'https://gudanghub.pages.dev';
const browser = await chromium.launch();
const page = await browser.newPage();

const events = [];
page.on('response', async (res) => {
  try {
    const url = res.url();
    if (!url.includes('workers.dev') && !url.includes('vercel.app')) return;
    const req = res.request();
    let action = '';
    const post = req.postData();
    if (post) { try { action = JSON.parse(post).action || ''; } catch {} }
    if (!action) action = new URL(url).searchParams.get('action') || '';
    const body = await res.text().catch(() => '');
    const auth = body.includes('AUTH_REQUIRED');
    events.push(`${new Date().toISOString().slice(11,23)} ${req.method()} ${action || '(ping)'} → ${res.status()}${auth ? '  *** AUTH_REQUIRED ***' : ''}`);
    if (auth) console.log('BODY:', body.slice(0, 160));
  } catch {}
});
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 140)); });

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.locator('input').first().fill('cb001');
await page.locator('input[type=password]').fill('gudang2025');
await page.keyboard.press('Enter');
await page.waitForTimeout(2500);
console.log('URL setelah login:', page.url());

// jelajah halaman yang dipakai cabang
for (const path of ['/order', '/dashboard', '/notifikasi']) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log(path, '→', page.url().includes('login') ? '*** DITENDANG KE LOGIN ***' : 'ok');
}

console.log('\n== jejak request ==');
console.log(events.join('\n'));
await browser.close();
