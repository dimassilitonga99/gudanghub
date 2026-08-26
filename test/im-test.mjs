import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';

const BASE = process.env.TEST_BASE || 'https://gudanghub.pages.dev';
mkdirSync('test/shots', { recursive: true });

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
});
page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 300)));

const step = (n, t) => console.log(`[${n}] ${t}`);

try {
  await step(1, 'Buka /login');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.screenshot({ path: 'test/shots/01-login.png' });

  await step(2, 'Login admin');
  await page.locator('input').first().fill('admin');
  await page.locator('input[type=password]').fill('gudang2025');
  await page.locator('button[type=submit], button:has-text("Masuk")').first().click();
  await page.waitForURL('**/dashboard', { timeout: 60000 });
  await page.waitForLoadState('networkidle');
  await step('2b', `URL sekarang: ${page.url()}`);
  await page.screenshot({ path: 'test/shots/02-dashboard.png' });

  await step(3, 'Klik menu Item Management');
  await page.locator('a:has-text("Item Management"), button:has-text("Item Management")').first().click();
  await page.waitForTimeout(4000);
  await step('3b', `URL setelah klik menu: ${page.url()}`);
  await page.screenshot({ path: 'test/shots/03-item-management.png', fullPage: false });

  const heading = await page.locator('h1:has-text("Kelola Item")').count();
  await step('3c', `Heading "Kelola Item" ditemukan: ${heading > 0}`);
  if (!heading) throw new Error('HALAMAN ITEM MANAGEMENT TIDAK TERMUAT (kemungkinan blank)');

  await step(4, 'Klik ikon pensil kartu pertama');
  const pencil = page.locator('div.group button', { has: page.locator('i.fi-sr-pencil') }).first();
  await pencil.waitFor({ state: 'visible', timeout: 15000 });
  await pencil.click();

  await step(5, 'Tunggu modal edit');
  let dialogOk = true;
  try {
    await page.waitForSelector('[role=dialog]', { timeout: 8000 });
  } catch {
    dialogOk = false;
    await step('5b', 'MODAL TIDAK MUNCUL — cek apakah halaman blank');
  }
  await page.screenshot({ path: 'test/shots/04-edit-clicked.png', fullPage: false });

  if (dialogOk) {
    await page.screenshot({ path: 'test/shots/05-modal-edit.png' });
    const previewVisible = await page.locator('[role=dialog] img, [role=dialog] i.fi-sr-image').count();
    await step('6', `Elemen gambar/placeholder di modal: ${previewVisible}`);
    // tutup modal
    await page.keyboard.press('Escape');
  }

  await step(7, 'SELESAI — ringkasan di bawah');
} catch (e) {
  await page.screenshot({ path: 'test/shots/99-error.png', fullPage: true }).catch(() => {});
  console.log(`[FAIL] ${String(e).slice(0, 400)}`);
}

await browser.close();

console.log('\n=== CONSOLE ERRORS ===');
console.log(consoleErrors.length ? consoleErrors.join('\n---\n') : '(tidak ada)');
console.log('\n=== PAGE ERRORS (crash) ===');
console.log(pageErrors.length ? pageErrors.join('\n---\n') : '(tidak ada)');
