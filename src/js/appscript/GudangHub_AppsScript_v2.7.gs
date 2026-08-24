// GUDANGHUB APPS SCRIPT BACKEND v2.7
// PT CENTRAL PERABOT UTAMA
// Fitur: order biasa/massal, STOK_GUDANG + STOK_TOKO wajib, stok master,
// login, ganti password, reset password, email queue, dashboard, edit order,
// item management (create, update, delete barang).

const EMAIL_ADMIN_GUDANG = 'silitongadimas@gmail.com';
const NAMA_PERUSAHAAN = 'PT CENTRAL PERABOT UTAMA';
const NAMA_SISTEM = 'GudangHub';
const TIMEZONE = 'Asia/Makassar';

const SHEET_MASTER_BARANG = 'MASTER_BARANG';
const SHEET_DAFTAR_CABANG = 'DAFTAR_CABANG';
const SHEET_ORDER_HEADER = 'ORDER_HEADER';
const SHEET_ORDER_DETAIL = 'ORDER_DETAIL';
const SHEET_USERS = 'USERS';
const SHEET_EMAIL_QUEUE = 'EMAIL_QUEUE';

const DETAIL_HEADERS = [
  'ORDER_ID','ID_CABANG','KODE_BARANG','NAMA_BARANG','KATEGORI',
  'QTY','SATUAN','HARGA_SATUAN','SUBTOTAL','ITEM_STATUS',
  'ORIGINAL_QTY','REASON','STOK_GUDANG','STOK_TOKO'
];

const BARANG_HEADERS = [
  'KODE_BARANG','NAMA_BARANG','KATEGORI','SATUAN','HARGA','STOK','STOK_GUDANG','STOK_TOKO','DESKRIPSI'
];

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_MASTER_BARANG, BARANG_HEADERS);
  ensureSheet_(ss, SHEET_DAFTAR_CABANG, ['ID_CABANG','NAMA_CABANG','PIC','EMAIL_CABANG','TELEPON','ALAMAT']);
  ensureSheet_(ss, SHEET_ORDER_HEADER, ['ORDER_ID','ID_CABANG','NAMA_CABANG','PIC','TANGGAL_ORDER','CATATAN','STATUS','TANGGAL_PROSES','DIPROSES_OLEH']);
  ensureDetailSheet_(ss.getSheetByName(SHEET_ORDER_DETAIL));
  ensureSheet_(ss, SHEET_USERS, ['USERNAME','PASSWORD','ROLE','NAMA','ID_CABANG']);
  ensureSheet_(ss, SHEET_EMAIL_QUEUE, ['ID','TO','CC','SUBJECT','HTML_BODY','STATUS','CREATED_AT','SENT_AT']);
  SpreadsheetApp.getUi().alert('Setup GudangHub v2.7 selesai. MASTER_BARANG headers: ' + BARANG_HEADERS.join(', '));
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) writeHeader_(sh, headers);
  return sh;
}

function ensureDetailSheet_(sh) {
  if (!sh) return;
  if (sh.getLastRow() === 0) writeHeader_(sh, DETAIL_HEADERS);
  const headers = getHeaders_(sh);
  const missing = DETAIL_HEADERS.filter(h => headers.indexOf(h) < 0);
  if (!missing.length) return;
  const start = sh.getLastColumn() + 1;
  sh.getRange(1, start, 1, missing.length).setValues([missing]);
  if (sh.getLastRow() > 1) sh.getRange(2, start, sh.getLastRow() - 1, missing.length).setValue('');
}

function writeHeader_(sh, headers) {
  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground('#1a1a35').setFontColor('#ff6b00').setFontWeight('bold');
}

function getHeaders_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(x => String(x).trim().toUpperCase());
}

function doGet(e) {
  try {
    const a = String(e?.parameter?.action || '');
    const p = e?.parameter?.payload ? JSON.parse(e.parameter.payload) : {};
    if (a === 'getBarang') return getBarang_();
    if (a === 'getCabang') return getCabang_();
    if (a === 'getOrders') return getOrders_();
    if (a === 'getOrderDetail') return getOrderDetail_(e.parameter.orderId || '');
    return dispatch_(a, p);
  } catch (err) { return json_({status:'error', message:err.message}); }
}

function doPost(e) {
  try {
    let p = {};
    if (e?.postData?.contents) { try { p = JSON.parse(e.postData.contents); } catch (_) {} }
    if (!p.action && e?.parameter?.payload) p = JSON.parse(e.parameter.payload);
    if (!p.action && e?.parameter?.action) p.action = e.parameter.action;
    return dispatch_(String(p.action || ''), p);
  } catch (err) { return json_({status:'error', message:err.message}); }
}

function dispatch_(action, p) {
  switch (action) {
    case 'submitOrder': return submitOrder_(p);
    case 'updateStatus': return updateStatus_(p);
    case 'editOrder': return editOrder_(p);
    case 'login': return login_(p);
    case 'changePassword': return changePassword_(p);
    case 'forgotPassword': return forgotPassword_(p);
    case 'sendEmailNotif': return sendEmailNotif_(p);
    case 'createBarang': return createBarang_(p);
    case 'updateBarang': return updateBarang_(p);
    case 'deleteBarang': return deleteBarang_(p);
    default: return json_({status:'error', message:'Action tidak dikenal: ' + action});
  }
}

function getBarang_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER_BARANG);
  if (!sh || sh.getLastRow() < 2) return json_({status:'ok', data:[]});
  return json_({status:'ok', data:rowsAsObjects_(sh)});
}

function createBarang_(p) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER_BARANG);
  if (!sh) return json_({status:'error', message:'Sheet MASTER_BARANG tidak ditemukan.'});
  const kode = String(p.kode || '').trim().toUpperCase();
  const nama = String(p.nama || '').trim();
  const kategori = String(p.kategori || '').trim();
  const satuan = String(p.satuan || 'PCS').trim();
  const harga = num_(p.harga);
  const stok = num_(p.stok);
  const stokGudang = requiredNumber_(p.stokGudang, 'Stok gudang', kode);
  const stokToko = requiredNumber_(p.stokToko, 'Stok toko', kode);
  const deskripsi = String(p.deskripsi || '').trim();
  if (!kode || !nama) return json_({status:'error', message:'Kode dan nama barang wajib diisi.'});
  if (findBy_(sh, 'KODE_BARANG', kode)) return json_({status:'error', message:'Kode barang sudah ada: ' + kode});
  const row = [kode, nama, kategori, satuan, harga, stok, stokGudang, stokToko, deskripsi];
  sh.appendRow(row);
  return json_({status:'ok', message:'Barang berhasil ditambahkan.', data:{KODE_BARANG:kode, NAMA_BARANG:nama}});
}

function updateBarang_(p) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER_BARANG);
  if (!sh) return json_({status:'error', message:'Sheet MASTER_BARANG tidak ditemukan.'});
  const kode = String(p.kode || '').trim().toUpperCase();
  if (!kode) return json_({status:'error', message:'Kode barang wajib diisi.'});
  const found = findBy_(sh, 'KODE_BARANG', kode);
  if (!found) return json_({status:'error', message:'Barang tidak ditemukan: ' + kode});
  const nama = p.nama !== undefined ? String(p.nama).trim() : found.NAMA_BARANG;
  const kategori = p.kategori !== undefined ? String(p.kategori).trim() : found.KATEGORI;
  const satuan = p.satuan !== undefined ? String(p.satuan).trim() : found.SATUAN;
  const harga = p.harga !== undefined ? num_(p.harga) : (found.HARGA || 0);
  const stok = p.stok !== undefined ? num_(p.stok) : (found.STOK || 0);
  const stokGudang = p.stokGudang !== undefined ? requiredNumber_(p.stokGudang, 'Stok gudang', kode) : (found.STOK_GUDANG || 0);
  const stokToko = p.stokToko !== undefined ? requiredNumber_(p.stokToko, 'Stok toko', kode) : (found.STOK_TOKO || 0);
  const deskripsi = p.deskripsi !== undefined ? String(p.deskripsi).trim() : (found.DESKRIPSI || '');
  const rowIdx = rowsAsObjects_(sh).findIndex(o => String(o.KODE_BARANG).trim().toUpperCase() === kode) + 2;
  const row = [kode, nama, kategori, satuan, harga, stok, stokGudang, stokToko, deskripsi];
  sh.getRange(rowIdx, 1, 1, sh.getLastColumn()).setValues([row]);
  return json_({status:'ok', message:'Barang berhasil diperbarui.', data:{KODE_BARANG:kode, NAMA_BARANG:nama}});
}

function deleteBarang_(p) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER_BARANG);
  if (!sh) return json_({status:'error', message:'Sheet MASTER_BARANG tidak ditemukan.'});
  const kode = String(p.kode || '').trim().toUpperCase();
  if (!kode) return json_({status:'error', message:'Kode barang wajib diisi.'});
  const found = findBy_(sh, 'KODE_BARANG', kode);
  if (!found) return json_({status:'error', message:'Barang tidak ditemukan: ' + kode});
  const all = rowsAsObjects_(sh);
  const rowIdx = all.findIndex(o => String(o.KODE_BARANG).trim().toUpperCase() === kode) + 2;
  sh.deleteRow(rowIdx);
  return json_({status:'ok', message:'Barang berhasil dihapus.', data:{KODE_BARANG:kode}});
}

function getCabang_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DAFTAR_CABANG);
  if (!sh || sh.getLastRow() < 2) return json_({status:'ok', data:[]});
  const h = getHeaders_(sh);
  const data = rowsAsObjects_(sh).map(o => { if (h.indexOf('EMAIL_CABANG') >= 0) o.EMAIL_CABANG = '***'; return o; });
  return json_({status:'ok', data:data});
}

function getOrders_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const oh = ss.getSheetByName(SHEET_ORDER_HEADER);
  const od = ss.getSheetByName(SHEET_ORDER_DETAIL);
  if (!oh || oh.getLastRow() < 2) return json_({status:'ok', data:[]});
  const details = {};
  if (od && od.getLastRow() > 1) rowsAsObjects_(od).forEach(o => {
    const id = String(o.ORDER_ID || '');
    (details[id] || (details[id] = [])).push(o);
  });
  const data = rowsAsObjects_(oh).map(o => { o.DETAIL = details[String(o.ORDER_ID || '')] || []; return o; });
  data.sort((a,b) => parseDate_(b.TANGGAL_ORDER) - parseDate_(a.TANGGAL_ORDER));
  return json_({status:'ok', data:data});
}

function getOrderDetail_(id) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ORDER_DETAIL);
  if (!sh || sh.getLastRow() < 2) return json_({status:'ok', data:[]});
  return json_({status:'ok', data:rowsAsObjects_(sh).filter(o => String(o.ORDER_ID).trim() === String(id).trim())});
}

function rowsAsObjects_(sh) {
  const raw = sh.getDataRange().getValues();
  if (raw.length < 2) return [];
  const headers = raw[0].map(x => String(x).trim());
  return raw.slice(1).filter(r => r[0] !== '' && r[0] !== null).map(r => {
    const o = {}; headers.forEach((h,i) => o[h] = r[i]); return o;
  });
}

function submitOrder_(p) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const oh = ss.getSheetByName(SHEET_ORDER_HEADER), od = ss.getSheetByName(SHEET_ORDER_DETAIL);
    const dc = ss.getSheetByName(SHEET_DAFTAR_CABANG), mb = ss.getSheetByName(SHEET_MASTER_BARANG);
    if (!oh || !od || !dc || !mb) return json_({status:'error', message:'Sheet belum lengkap. Jalankan setupSheets().'});
    ensureDetailSheet_(od);
    const idCabang = String(p.idCabang || '').trim().toUpperCase();
    const items = Array.isArray(p.items) ? p.items : [];
    if (!idCabang || !items.length) return json_({status:'error', message:'Cabang atau barang kosong.'});
    const cabang = findBy_(dc, 'ID_CABANG', idCabang);
    if (!cabang) return json_({status:'error', message:'Cabang tidak ditemukan: ' + idCabang});
    const master = masterMap_(mb);
    const clean = [];
    const stokKurang = [];
    items.forEach(it => {
      const kode = String(it.kode || '').trim().toUpperCase();
      const q = num_(it.qty);
      const sg = requiredNumber_(it.stokGudang, 'Stok gudang', kode);
      const st = requiredNumber_(it.stokToko, 'Stok toko', kode);
      const b = master[kode];
      if (!b) throw new Error('Barang tidak ditemukan: ' + kode);
      if (q <= 0) throw new Error('Jumlah harus lebih dari 0: ' + kode);
      if (b.stok < q) stokKurang.push({kode: kode, stokAda:b.stok, diminta:q});
      clean.push({kode:kode, nama:String(it.nama || b.nama), kategori:String(it.kategori || b.kategori), qty:q, satuan:String(it.satuan || b.satuan), harga:num_(it.harga) || b.harga, stokGudang:sg, stokToko:st});
    });
    if (stokKurang.length) return json_({status:'error', message:'Stok sistem tidak cukup.', stokKurang:stokKurang});
    const now = new Date();
    const orderId = generateOrderId_(now, idCabang);
    const tgl = formatWITA_(now);
    oh.appendRow([orderId,idCabang,cabang.NAMA_CABANG || '',cabang.PIC || '',tgl,String(p.catatan || '').trim(),'PENDING','','']);
    const h = getHeaders_(od), rows = clean.map(it => {
      const row = new Array(od.getLastColumn()).fill('');
      h.forEach((key,i) => {
        if (key === 'ORDER_ID') row[i]=orderId;
        else if (key === 'ID_CABANG') row[i]=idCabang;
        else if (key === 'KODE_BARANG') row[i]=it.kode;
        else if (key === 'NAMA_BARANG') row[i]=it.nama;
        else if (key === 'KATEGORI') row[i]=it.kategori;
        else if (key === 'QTY') row[i]=it.qty;
        else if (key === 'SATUAN') row[i]=it.satuan;
        else if (key === 'HARGA_SATUAN') row[i]=it.harga;
        else if (key === 'SUBTOTAL') row[i]=it.qty * it.harga;
        else if (key === 'ITEM_STATUS') row[i]='APPROVED';
        else if (key === 'ORIGINAL_QTY') row[i]=it.qty;
        else if (key === 'STOK_GUDANG') row[i]=it.stokGudang;
        else if (key === 'STOK_TOKO') row[i]=it.stokToko;
      });
      return row;
    });
    od.getRange(od.getLastRow()+1,1,rows.length,od.getLastColumn()).setValues(rows);
    clean.forEach(it => { master[it.kode].stok -= it.qty; mb.getRange(master[it.kode].row, master.stokCol + 1).setValue(master[it.kode].stok); });
    queueEmailKeAdmin_(cabang, orderId, tgl, clean, p.catatan || '');
    return json_({status:'ok', message:'Order berhasil dikirim.', orderId:orderId});
  } catch (err) { return json_({status:'error', message:err.message}); }
  finally { try { lock.releaseLock(); } catch (_) {} }
}

function updateStatus_(p) {
  const id = String(p.orderId || '').trim();
  const status = String(p.status || '').trim().toUpperCase();
  const alasan = String(p.alasan || '').trim();
  if (!id || !['APPROVED','REJECTED'].includes(status)) return json_({status:'error',message:'Data status tidak valid.'});
  if (status === 'REJECTED' && !alasan) return json_({status:'error',message:'Alasan penolakan wajib diisi.'});
  const ss = SpreadsheetApp.getActiveSpreadsheet(), oh=ss.getSheetByName(SHEET_ORDER_HEADER), od=ss.getSheetByName(SHEET_ORDER_DETAIL), mb=ss.getSheetByName(SHEET_MASTER_BARANG);
  const found = findRow_(oh,'ORDER_ID',id);
  if (!found) return json_({status:'error',message:'Order tidak ditemukan.'});
  const h=getHeaders_(oh), now=formatWITA_(new Date());
  oh.getRange(found.row,h.indexOf('STATUS')+1).setValue(status);
  oh.getRange(found.row,h.indexOf('TANGGAL_PROSES')+1).setValue(now);
  oh.getRange(found.row,h.indexOf('DIPROSES_OLEH')+1).setValue('Admin Dashboard');
  if (status === 'REJECTED') restoreRejected_(od,mb,id,alasan);
  const obj = {}; h.forEach((k,i)=>obj[k]=found.values[i]); obj.ORDER_ID=id; obj.STATUS=status; obj.TANGGAL_PROSES=now;
  queueEmailStatus_(obj,alasan);
  return json_({status:'ok',message:'Status berhasil diperbarui.'});
}

function editOrder_(p) {
  const id=String(p.orderId || '').trim(), items=Array.isArray(p.items)?p.items:[];
  if (!id) return json_({status:'error',message:'orderId diperlukan.'});
  const ss=SpreadsheetApp.getActiveSpreadsheet(), oh=ss.getSheetByName(SHEET_ORDER_HEADER), od=ss.getSheetByName(SHEET_ORDER_DETAIL), mb=ss.getSheetByName(SHEET_MASTER_BARANG);
  ensureDetailSheet_(od);
  const found=findRow_(oh,'ORDER_ID',id); if (!found) return json_({status:'error',message:'Order tidak ditemukan.'});
  const master=masterMap_(mb), clean=[];
  items.forEach(it=>{
    const kode=String(it.kode||'').trim().toUpperCase(), status=['APPROVED','REJECTED','DELETED'].includes(String(it.itemStatus||'').toUpperCase())?String(it.itemStatus).toUpperCase():'APPROVED';
    const reason=String(it.reason||'').trim(); if ((status==='REJECTED'||status==='DELETED')&&!reason) throw new Error('Alasan wajib untuk '+kode);
    clean.push({kode:kode,nama:String(it.nama||master[kode]?.nama||''),kategori:String(it.kategori||master[kode]?.kategori||''),qty:Math.max(0,num_(it.qty)),satuan:String(it.satuan||master[kode]?.satuan||'PCS'),harga:num_(it.harga)||master[kode]?.harga||0,status:status,reason:reason,originalQty:num_(it.originalQty),stokGudang:requiredNumber_(it.stokGudang,'Stok gudang',kode),stokToko:requiredNumber_(it.stokToko,'Stok toko',kode)});
  });
  const hOD=getHeaders_(od), all=rowsAsObjects_(od), oldRows=[];
  all.forEach((o,i)=>{if(String(o.ORDER_ID).trim()===id) oldRows.push(i+2);});
  oldRows.sort((a,b)=>b-a).forEach(r=>od.deleteRow(r));
  const rows=clean.map(it=>{const row=new Array(od.getLastColumn()).fill('');hOD.forEach((k,i)=>{if(k==='ORDER_ID')row[i]=id;else if(k==='ID_CABANG')row[i]=found.object.ID_CABANG;else if(k==='KODE_BARANG')row[i]=it.kode;else if(k==='NAMA_BARANG')row[i]=it.nama;else if(k==='KATEGORI')row[i]=it.kategori;else if(k==='QTY')row[i]=it.qty;else if(k==='SATUAN')row[i]=it.satuan;else if(k==='HARGA_SATUAN')row[i]=it.harga;else if(k==='SUBTOTAL')row[i]=it.qty*it.harga;else if(k==='ITEM_STATUS')row[i]=it.status;else if(k==='ORIGINAL_QTY')row[i]=it.originalQty;else if(k==='REASON')row[i]=it.reason;else if(k==='STOK_GUDANG')row[i]=it.stokGudang;else if(k==='STOK_TOKO')row[i]=it.stokToko;});return row;});
  if(rows.length)od.getRange(od.getLastRow()+1,1,rows.length,od.getLastColumn()).setValues(rows);
  const hOH=getHeaders_(oh), kirim=p.kirimEmail===true, status= kirim ? (clean.some(x=>x.status==='APPROVED')?'APPROVED':'REJECTED') : String(found.object.STATUS||'PENDING').toUpperCase();
  oh.getRange(found.row,hOH.indexOf('STATUS')+1).setValue(status);
  if(kirim){const t=formatWITA_(new Date());oh.getRange(found.row,hOH.indexOf('TANGGAL_PROSES')+1).setValue(t);oh.getRange(found.row,hOH.indexOf('DIPROSES_OLEH')+1).setValue(String(p.diprosesOleh||'Admin Dashboard'));}
  return json_({status:'ok',message:'Perubahan order disimpan.',statusHeader:status});
}

function login_(p) {
  const user=String(p.username||'').trim().toLowerCase(), pass=String(p.password||'');
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS); if(!sh||sh.getLastRow()<2)return json_({status:'error',message:'Data akun belum tersedia.'});
  const h=getHeaders_(sh), rows=sh.getDataRange().getValues();
  for(let r=1;r<rows.length;r++)if(String(rows[r][h.indexOf('USERNAME')]).trim().toLowerCase()===user){const stored=String(rows[r][h.indexOf('PASSWORD')]||'');if(stored!==pass&&stored!==sha256_(pass))return json_({status:'error',message:'Password salah.'});return json_({status:'ok',token:Utilities.getUuid(),user:{username:user,role:String(rows[r][h.indexOf('ROLE')]||'').toLowerCase(),nama:String(rows[r][h.indexOf('NAMA')]||''),idCabang:String(rows[r][h.indexOf('ID_CABANG')]||'').toUpperCase()||null}});}
  return json_({status:'error',message:'Username tidak ditemukan.'});
}

function changePassword_(p) {
  const user=String(p.username||'').trim().toLowerCase(), old=String(p.passwordLama||''), nw=String(p.passwordBaru||'');
  if(nw.length<6)return json_({status:'error',message:'Password baru minimal 6 karakter.'});
  const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS), h=getHeaders_(sh), rows=sh.getDataRange().getValues();
  for(let r=1;r<rows.length;r++)if(String(rows[r][h.indexOf('USERNAME')]).trim().toLowerCase()===user){const stored=String(rows[r][h.indexOf('PASSWORD')]||'');if(stored!==old&&stored!==sha256_(old))return json_({status:'error',message:'Password lama salah.'});sh.getRange(r+1,h.indexOf('PASSWORD')+1).setValue(/^[a-f0-9]{64}$/.test(stored)?sha256_(nw):nw);return json_({status:'ok',message:'Password berhasil diubah.'});}
  return json_({status:'error',message:'Username tidak ditemukan.'});
}

function forgotPassword_(p) { return json_({status:'error',message:'Reset password tersedia melalui admin gudang.'}); }
function sendEmailNotif_(p) { return json_({status:'error',message:'Gunakan editOrder dengan kirimEmail:true.'}); }

function createBarang_(p) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER_BARANG);
  if (!sh) return json_({status:'error', message:'Sheet MASTER_BARANG tidak ditemukan.'});
  const kode = String(p.kode || '').trim().toUpperCase();
  const nama = String(p.nama || '').trim();
  const kategori = String(p.kategori || '').trim();
  const satuan = String(p.satuan || 'PCS').trim();
  const harga = num_(p.harga);
  const stok = num_(p.stok);
  const stokGudang = requiredNumber_(p.stokGudang, 'Stok gudang', kode);
  const stokToko = requiredNumber_(p.stokToko, 'Stok toko', kode);
  const deskripsi = String(p.deskripsi || '').trim();
  if (!kode || !nama) return json_({status:'error', message:'Kode dan nama barang wajib diisi.'});
  if (findBy_(sh, 'KODE_BARANG', kode)) return json_({status:'error', message:'Kode barang sudah ada: ' + kode});
  const row = [kode, nama, kategori, satuan, harga, stok, stokGudang, stokToko, deskripsi];
  sh.appendRow(row);
  return json_({status:'ok', message:'Barang berhasil ditambahkan.', data:{KODE_BARANG:kode, NAMA_BARANG:nama}});
}

function updateBarang_(p) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER_BARANG);
  if (!sh) return json_({status:'error', message:'Sheet MASTER_BARANG tidak ditemukan.'});
  const kode = String(p.kode || '').trim().toUpperCase();
  if (!kode) return json_({status:'error', message:'Kode barang wajib diisi.'});
  const found = findBy_(sh, 'KODE_BARANG', kode);
  if (!found) return json_({status:'error', message:'Barang tidak ditemukan: ' + kode});
  const nama = p.nama !== undefined ? String(p.nama).trim() : found.NAMA_BARANG;
  const kategori = p.kategori !== undefined ? String(p.kategori).trim() : found.KATEGORI;
  const satuan = p.satuan !== undefined ? String(p.satuan).trim() : found.SATUAN;
  const harga = p.harga !== undefined ? num_(p.harga) : (found.HARGA || 0);
  const stok = p.stok !== undefined ? num_(p.stok) : (found.STOK || 0);
  const stokGudang = p.stokGudang !== undefined ? requiredNumber_(p.stokGudang, 'Stok gudang', kode) : (found.STOK_GUDANG || 0);
  const stokToko = p.stokToko !== undefined ? requiredNumber_(p.stokToko, 'Stok toko', kode) : (found.STOK_TOKO || 0);
  const deskripsi = p.deskripsi !== undefined ? String(p.deskripsi).trim() : (found.DESKRIPSI || '');
  const rowIdx = rowsAsObjects_(sh).findIndex(o => String(o.KODE_BARANG).trim().toUpperCase() === kode) + 2;
  const row = [kode, nama, kategori, satuan, harga, stok, stokGudang, stokToko, deskripsi];
  sh.getRange(rowIdx, 1, 1, sh.getLastColumn()).setValues([row]);
  return json_({status:'ok', message:'Barang berhasil diperbarui.', data:{KODE_BARANG:kode, NAMA_BARANG:nama}});
}

function deleteBarang_(p) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_MASTER_BARANG);
  if (!sh) return json_({status:'error', message:'Sheet MASTER_BARANG tidak ditemukan.'});
  const kode = String(p.kode || '').trim().toUpperCase();
  if (!kode) return json_({status:'error', message:'Kode barang wajib diisi.'});
  const found = findBy_(sh, 'KODE_BARANG', kode);
  if (!found) return json_({status:'error', message:'Barang tidak ditemukan: ' + kode});
  const all = rowsAsObjects_(sh);
  const rowIdx = all.findIndex(o => String(o.KODE_BARANG).trim().toUpperCase() === kode) + 2;
  sh.deleteRow(rowIdx);
  return json_({status:'ok', message:'Barang berhasil dihapus.', data:{KODE_BARANG:kode}});
}

function masterMap_(sh) {
  const h=getHeaders_(sh), out={}; rowsAsObjects_(sh).forEach((o,i)=>{const k=String(o.KODE_BARANG||'').trim().toUpperCase();if(k)out[k]={row:i+2,stok:num_(o.STOK),nama:String(o.NAMA_BARANG||''),kategori:String(o.KATEGORI||''),satuan:String(o.SATUAN||'PCS'),harga:num_(o.HARGA)};});
  out.stokCol=h.indexOf('STOK'); return out;
}
function findBy_(sh,key,val){return rowsAsObjects_(sh).find(o=>String(o[key]||'').trim().toUpperCase()===String(val).trim().toUpperCase())||null;}
function findRow_(sh,key,val){const h=getHeaders_(sh), col=h.indexOf(key);if(col<0)return null;const data=sh.getDataRange().getValues();for(let r=1;r<data.length;r++)if(String(data[r][col]).trim()===String(val).trim()){const obj={};h.forEach((k,i)=>obj[k]=data[r][i]);return{row:r+1,values:data[r],object:obj};}return null;}
function requiredNumber_(v,label,kode){const n=Number(v);if(v===''||v===null||v===undefined||!Number.isFinite(n)||n<0)throw new Error(label+' wajib diisi untuk '+kode);return n;}
function num_(v){const n=parseFloat(v);return Number.isFinite(n)?n:0;}
function restoreRejected_(od,mb,id,alasan){if(!od||!mb||od.getLastRow()<2)return;const hm=getHeaders_(mb), ho=getHeaders_(od), map=masterMap_(mb), rows=od.getDataRange().getValues();rows.slice(1).forEach((r,i)=>{if(String(r[ho.indexOf('ORDER_ID')]).trim()!==id)return;const k=String(r[ho.indexOf('KODE_BARANG')]).toUpperCase(),q=num_(r[ho.indexOf('QTY')]);if(map[k]){map[k].stok+=q;mb.getRange(map[k].row,map.stokCol+1).setValue(map[k].stok);}if(ho.indexOf('ITEM_STATUS')>=0)od.getRange(i+2,ho.indexOf('ITEM_STATUS')+1).setValue('REJECTED');if(ho.indexOf('REASON')>=0)od.getRange(i+2,ho.indexOf('REASON')+1).setValue(alasan);});}

function queueEmailKeAdmin_(cabang,id,tgl,items,catatan){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMAIL_QUEUE);if(!sh)return;const html='<h2>Order Baru '+escapeHTML_(id)+'</h2><p>Cabang: '+escapeHTML_(cabang.NAMA_CABANG||'')+'</p><table border="1" cellpadding="6"><tr><th>Kode</th><th>Nama</th><th>Qty</th><th>Stok Gudang</th><th>Stok Toko</th></tr>'+items.map(i=>'<tr><td>'+escapeHTML_(i.kode)+'</td><td>'+escapeHTML_(i.nama)+'</td><td>'+i.qty+'</td><td>'+i.stokGudang+'</td><td>'+i.stokToko+'</td></tr>').join('')+'</table><p>'+escapeHTML_(catatan)+'</p>';sh.appendRow([Utilities.getUuid(),EMAIL_ADMIN_GUDANG,'','Order Baru '+id,html,'PENDING',new Date(),'']);}
function queueEmailStatus_(o,alasan){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMAIL_QUEUE);if(sh)sh.appendRow([Utilities.getUuid(),EMAIL_ADMIN_GUDANG,'','Status Order '+o.ORDER_ID,'<h2>Status '+o.STATUS+'</h2><p>'+escapeHTML_(alasan)+'</p>','PENDING',new Date(),'']);}
function processEmailQueue(){const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_EMAIL_QUEUE);if(!sh||sh.getLastRow()<2)return;const h=getHeaders_(sh), rows=sh.getDataRange().getValues();for(let i=1;i<rows.length;i++)if(String(rows[i][h.indexOf('STATUS')]).toUpperCase()==='PENDING')try{MailApp.sendEmail({to:String(rows[i][h.indexOf('TO')]),cc:String(rows[i][h.indexOf('CC')]||''),subject:String(rows[i][h.indexOf('SUBJECT')]),htmlBody:String(rows[i][h.indexOf('HTML_BODY')]),name:NAMA_SISTEM});sh.getRange(i+1,h.indexOf('STATUS')+1).setValue('SENT');sh.getRange(i+1,h.indexOf('SENT_AT')+1).setValue(new Date());}catch(e){sh.getRange(i+1,h.indexOf('STATUS')+1).setValue('ERROR: '+e.message.slice(0,100));}}

function PASANG_TRIGGER(){ScriptApp.getProjectTriggers().forEach(t=>{if(['processEmailQueue'].includes(t.getHandlerFunction()))ScriptApp.deleteTrigger(t);});ScriptApp.newTrigger('processEmailQueue').timeBased().everyMinutes(1).create();SpreadsheetApp.getUi().alert('Trigger email terpasang.');}
function generateOrderId_(d,c){return 'ORD-'+Utilities.formatDate(d,TIMEZONE,'yyyyMMdd-HHmmss-SSS')+'-'+c+'-'+Utilities.getUuid().slice(0,6).toUpperCase();}
function formatWITA_(d){return Utilities.formatDate(d,TIMEZONE,'dd-MM-yyyy HH:mm:ss');}
function parseDate_(s){const p=String(s||'').split(' '),d=(p[0]||'').split('-');return d.length===3?new Date(d[2]+'-'+d[1]+'-'+d[0]+'T'+(p[1]||'00:00:00')+'+08:00'):new Date(0);}
function sha256_(text){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8).map(b=>{const v=(b<0?b+256:b).toString(16);return v.length===1?'0'+v:v;}).join('');}
function escapeHTML_(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}

function onOpen(){SpreadsheetApp.getUi().createMenu('GudangHub').addItem('Setup Sheets','setupSheets').addItem('Pasang Trigger Email','PASANG_TRIGGER').addItem('Proses Email Sekarang','processEmailQueue').addToUi();}
