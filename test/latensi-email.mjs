// Ukur latensi email: submit → SENT dalam hitungan detik?
const W = 'https://gudanghub-api-proxy.silitongadimas.workers.dev';
const V5 = 'https://gudanghub-api.vercel.app/api';
const call = (action, payload) => {
  const fd = new FormData();
  fd.append('payload', JSON.stringify({ action, ...payload }));
  return fetch(W, { method: 'POST', body: fd }).then((r) => r.json());
};

const lgA = await call('login', { username: 'admin', password: 'gudang2025', token: '' });
const lgC = await call('login', { username: 'cb001', password: 'gudang2025', token: '' });
const aTok = await fetch(V5 + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'gudang2025' }) }).then((r) => r.json()).then((j) => j.access_token);

const t0 = Date.now();
const sub = await call('submitOrder', { token: lgC.token, idCabang: 'CB001', catatan: 'tes-latensi',
  items: [{ kode: 'NN10885', qty: 1, satuan: 'ROL' }] });
console.log('submit:', sub.status, sub.orderId, '(' + (Date.now() - t0) + 'ms)');

// poll status antrean via /emails
let sentAt = null;
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  const em = await fetch(V5 + '/emails?limit=100', { headers: { Authorization: 'Bearer ' + aTok } })
    .then((r) => r.json());
  const row = (em.data || []).find((e) => e.subject.includes(sub.orderId));
  if (row && row.status === 'SENT') { sentAt = Date.now(); break; }
}
console.log(sentAt
  ? 'EMAIL TERKIRIM dalam ' + ((sentAt - t0) / 1000).toFixed(1) + ' detik sejak submit'
  : 'belum SENT setelah 20 detik');

process.exit(0);
