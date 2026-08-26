// E2E produksi: order cabang → email admin; approve/edit → email cabang
const W = 'https://gudanghub-api-proxy.silitongadimas.workers.dev';
const call = (action, payload) => {
  const fd = new FormData();
  fd.append('payload', JSON.stringify({ action, ...payload }));
  return fetch(W, { method: 'POST', body: fd }).then(async (r) => {
    const t = await r.text();
    if (t.startsWith('GZ1:')) {
      const json = await new Response(new Blob([Buffer.from(t.slice(4), 'base64')]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      return JSON.parse(json);
    }
    return JSON.parse(t);
  });
};

const lgA = await call('login', { username: 'admin', password: 'gudang2025', token: '' });
const lgC = await call('login', { username: 'cb001', password: 'gudang2025', token: '' });
console.log('login admin/cabang:', lgA.status, lgC.status);
const T = lgC.token, TA = lgA.token;

// 1. submit order (email admin ter-queue)
const sub = await call('submitOrder', { token: T, idCabang: 'CB001', catatan: 'e2e-email',
  items: [{ kode: 'NN10885', qty: 2, satuan: 'ROL', stokSistem: 5, stokGudang: 2, stokToko: 1 }] });
console.log('submit:', sub.status, sub.orderId);

// 2. cek antrean via /emails (admin, lewat REST langsung)
const V5 = 'https://gudanghub-api.vercel.app/api';
const listEm = async () => {
  const r = await fetch(V5 + '/emails', { headers: { Authorization: 'Bearer ' + await access() } });
  return (await r.json()).data || [];
};
let refreshTok = null;
const access = async () => {
  const r = await fetch(V5 + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'gudang2025' }) });
  return (await r.json()).access_token;
};

// 3. approve → email status ke cabang
const ap = await call('updateStatus', { token: TA, orderId: sub.orderId, status: 'APPROVED' });
console.log('approve:', ap.status);

// 4. edit kirimEmail → email perubahan
const ed = await call('editOrder', { token: TA, orderId: sub.orderId, kirimEmail: true,
  catatanAdmin: 'penyesuaian e2e',
  items: [{ kode: 'NN10885', qty: 4, originalQty: 2, itemStatus: 'APPROVED', satuan: 'ROL', harga: 210000 }] });
console.log('edit:', ed.status);

await new Promise(r => setTimeout(r, 1500));
const ems = await listEm();
for (const e of ems.slice(0, 3))
  console.log('email:', e.status.slice(0, 20), '| to=' + e.to.slice(0, 26), '| cc=' + (e.cc || '-').slice(0, 26), '|', e.subject.slice(0, 48));

// 5. proses manual (tanpa RESEND key → tetap PENDING, tak error)
const pr = await call('sendEmailNotif', { token: TA });
console.log('process:', pr.status, pr.message);

process.exit(0);
