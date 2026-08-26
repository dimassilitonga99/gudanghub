// Smoke test API-level: semua action utama via worker adapter (jalur frontend produksi)
const W = 'https://gudanghub-api-proxy.silitongadimas.workers.dev';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

function call(action, payload) {
  const fd = new FormData();
  fd.append('payload', JSON.stringify({ action, ...payload }));
  return fetch(W, { method: 'POST', body: fd }).then(async (r) => {
    const text = await r.text();
    if (text.startsWith('GZ1:')) {
      const gz = Buffer.from(text.slice(4), 'base64');
      const json = await new Response(
        new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip')),
      ).text();
      try { return JSON.parse(json); } catch { return { status: 'error', message: json.slice(0, 80) }; }
    }
    try { return JSON.parse(text); } catch { return { status: 'error', message: text.slice(0, 80) }; }
  });
}

(async () => {
  // 1. login
  const login = await call('login', { username: 'admin', password: 'gudang2025', token: '' });
  check('login', login.status === 'ok', login.user?.username);
  const T = login.token;

  // helper dengan token sesi
  const authed = (action, payload = {}) => call(action, { ...payload, token: T });

  // 2. getBarang (GZ1 compressed)
  const barang = await authed('getBarang');
  const n = Array.isArray(barang.data) ? barang.data.length : -1;
  check('getBarang', n > 4000, `${n} item`);

  // 3. getCabang
  const cab = await authed('getCabang');
  check('getCabang', cab.status === 'ok' && cab.data?.length >= 4, `${cab.data?.length} cabang`);

  // 4. getOrders
  const ord = await authed('getOrders');
  check('getOrders', ord.status === 'ok', `${ord.data?.length} order`);

  // 5. getOrderDetail (order pertama)
  if (ord.data?.length) {
    const det = await authed('getOrderDetail', { orderId: ord.data[0].ORDER_ID });
    check('getOrderDetail', det.status === 'ok', `${det.data?.length} item`);
  }

  // 6. getGambar (item dgn gambar R2)
  const g = await authed('getGambar', { kode: 'NK0003' });
  check('getGambar NK0003', g.data?.gambar?.includes('/img/'), g.data?.gambar || '(kosong)');
  if (g.data?.gambar) {
    const img = await fetch(g.data.gambar);
    check('R2 image serve', img.status === 200, `HTTP ${img.status}`);
  }

  // 7. cart sync + get
  const cs = await authed('syncCart', { cart: { TEST1: { qty: 2 } } });
  const cg = await authed('getCart');
  check('cart sync+get', cs.status === 'ok' && cg.status === 'ok', cg.cart?.includes('TEST1') ? 'persist' : '?');

  // 8. submitFeedback
  const fb = await authed('submitFeedback', { rating: 5, pesan: 'smoke test otomatis' });
  check('submitFeedback', fb.status === 'ok');

  // 9. CRUD barang (buat dummy → update → hapus; tanpa gambar)
  const kode = 'ZZTEST' + Date.now().toString().slice(-6);
  const cr = await authed('createBarang', { kode, nama: 'TEST SMOKE', kategori: 'TEST', satuan: 'PCS', harga: 1000, stok: 1 });
  check('createBarang', cr.status === 'ok');
  const up = await authed('updateBarang', { kode, nama: 'TEST SMOKE EDIT', harga: 2000 });
  check('updateBarang', up.status === 'ok');
  const del = await authed('deleteBarang', { kode });
  check('deleteBarang', del.status === 'ok');

  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} PASS`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
