import { Icon } from './ui/icon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { toastError, toastSuccess } from '@/lib/toast';

import { CABANG } from '@/lib/config';
import { chunkArray, formatTanggalCetak, toInt } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Kertas 21×15,1 cm — 5 item/halaman agar item panjang tidak merusak layout
export const PRINT_ITEMS_PER_PAGE = 5;

export interface PrintItem {
  kode: string;
  nama: string;
  kategori: string;
  qty: number;
  satuan: string;
  harga: number;
  itemStatus: string;
  reason?: string;
  originalQty?: number;
  stokGudang: number | '';
  stokToko: number | '';
  stokSistem: number | '';
  stokPicker?: string | number;
  catatanItem?: string;
}

export interface PrintFormProps {
  open: boolean;
  title: string;
  orderId: string;
  idCabang: string;
  tanggalCetak: Date;
  nomorOrder: string;
  statusOrder?: string;
  items: PrintItem[];
  stokLookup?: (kode: string) => number | string | undefined;
  showStatus?: boolean;
  onClose: () => void;
}

function buildPage(
  pageItems: PrintItem[],
  info: {
    pic: string;
    nomor: string;
    tanggal: string;
    pageLabel: string;
    statusOrder?: string;
    stokLookup?: (kode: string) => number | string | undefined;
  },
): React.ReactNode {
  const statusBadge = (() => {
    if (!info.statusOrder) return null;
    const st = info.statusOrder.toUpperCase();
    let bg = '#f59e0b';
    let label = 'MENUNGGU';
    if (st === 'APPROVED') {
      bg = '#16a34a';
      label = 'DISETUJUI';
    } else if (st === 'REJECTED') {
      bg = '#dc2626';
      label = 'DITOLAK';
    }
    return (
      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700, color: '#fff', background: bg }}>
        {label}
      </span>
    );
  })();

  const cell: React.CSSProperties = {
    padding: '4px 3px',
    border: '1px solid #000',
    fontFamily: 'Arial, sans-serif',
    fontSize: 12,
    fontWeight: 700,
    verticalAlign: 'middle',
    textAlign: 'center',
    lineHeight: 1.2,
  };
  const headerCell = (w?: number): React.CSSProperties => ({
    padding: '5px 3px',
    border: '1px solid #000',
    fontFamily: 'Arial, sans-serif',
    fontSize: 11,
    fontWeight: 800,
    textAlign: 'center',
    verticalAlign: 'middle',
    lineHeight: 1.2,
    ...(w ? { width: w } : {}),
  });
  const signBase: React.CSSProperties = { fontFamily: 'Arial, sans-serif', verticalAlign: 'top' };

  const pageBadge = info.pageLabel ? (
    <span style={{ display: 'inline-block', padding: '3px 10px', background: '#ff6b00', color: '#fff', borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginLeft: 8 }}>
      HALAMAN {info.pageLabel}
    </span>
  ) : null;

  return (
    <div
      className="print-sheet"
      style={{
        width: '21cm',
        height: '15.1cm',
        position: 'relative',
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
        margin: '0 auto 24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="print-page-admin"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '15.1cm',
          height: '21cm',
          boxSizing: 'border-box',
          padding: '4mm 5mm',
          margin: 0,
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          transformOrigin: 'center center',
          background: '#fff',
          color: '#000',
          fontFamily: 'Arial, sans-serif',
          fontSize: 12,
        }}
      >
      {/* KOP */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', paddingBottom: 6, paddingTop: 2 }}>
              <div className="print-kop-title" style={{ fontFamily: 'Arial, sans-serif', fontSize: 24, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>
                <span style={{ color: '#E67E22' }}>FORM</span>
                <span style={{ color: '#1B4F94' }}> ORDER BARANG</span>
              </div>
            </td>
            <td style={{ verticalAlign: 'top', textAlign: 'right', width: 120, paddingBottom: 6 }}>
              <img
                className="print-kop-logo"
                src="./images/logo/logo-nk.png"
                alt="Logo Nasional Kitchen"
                style={{ width: 100, height: 'auto', display: 'block', marginLeft: 'auto' }}
                crossOrigin="anonymous"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ borderTop: '1px solid #000', marginBottom: 6 }} />

      {/* INFO */}
      <table className="print-info-table" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', marginBottom: 8, fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#000' }}>
        <tbody>
          <tr>
            <td className="info-col-label" style={{ padding: '2px 0', width: 100, fontWeight: 700, verticalAlign: 'top' }}>DIBUAT OLEH</td>
            <td style={{ padding: '2px 0', verticalAlign: 'top', fontWeight: 600 }}>: {info.pic}</td>
            <td style={{ padding: '2px 0', verticalAlign: 'top' }} />
          </tr>
          <tr>
            <td className="info-col-label" style={{ padding: '2px 0', fontWeight: 700, verticalAlign: 'top' }}>NOMOR ORDER</td>
            <td style={{ padding: '2px 0', verticalAlign: 'top', fontWeight: 600 }}>
              : {info.nomor}
              {pageBadge}
            </td>
            <td style={{ padding: '2px 0', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', fontWeight: 600 }}>
              <span style={{ fontWeight: 700 }}>Hari/Tgl</span> : {info.tanggal}
            </td>
          </tr>
          {info.statusOrder && (
            <tr>
              <td className="info-col-label" style={{ padding: '2px 0', fontWeight: 700, verticalAlign: 'top' }}>STATUS ORDER</td>
              <td colSpan={2} style={{ padding: '2px 0', verticalAlign: 'top' }}>
                : {statusBadge}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* TABEL ITEM */}
      <table className="print-items-table" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', border: '1px solid #000', marginBottom: 10 }}>
        <thead>
          <tr style={{ background: '#B4D6F0' }}>
            <th style={headerCell(48)}>STOCK<br />SISTEM</th>
            <th style={headerCell(48)}>STOCK<br />(Gudang)</th>
            <th style={headerCell(44)}>STOCK<br />(Rak)</th>
            <th style={headerCell(52)}>JMLH<br />ORDER</th>
            <th style={headerCell(65)}>KODE ITEM</th>
            <th style={headerCell()}>NAMA ITEM</th>
            <th style={headerCell(64)}>JENIS</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((it, i) => {
            const stokSistem =
              it.stokSistem !== '' ? toInt(it.stokSistem) : toInt(info.stokLookup?.(it.kode) ?? 0);
            return (
              <tr key={String(it.kode) + i}>
                <td style={cell}>{stokSistem}</td>
                <td style={cell}>{it.stokGudang === '' ? '0' : it.stokGudang}</td>
                <td style={cell}>{it.stokToko === '' ? '0' : it.stokToko}</td>
                <td style={{ ...cell, color: '#00B050', fontWeight: 800 }}>
                  {it.qty} {String(it.satuan || 'PCS').toUpperCase()}
                </td>
                <td style={{ ...cell, padding: '4px 6px', fontSize: 12 }}>{it.kode}</td>
                <td style={{ ...cell, padding: '4px 6px', fontSize: 12, lineHeight: 1.25 }}>
                  {String(it.nama || '').toUpperCase()}
                  {it.catatanItem ? (
                    <span style={{ color: '#DC2626', fontWeight: 800, fontStyle: 'italic' }}>
                      {' '}({it.catatanItem})
                    </span>
                  ) : null}
                </td>
                <td style={{ ...cell, padding: '4px 6px', fontSize: 12, fontWeight: 800 }}>
                  {String(it.kategori || 'ELEKTRONIK').toUpperCase()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* TANDA TANGAN — merged tengah, garis atas-bawah */}
      <table className="print-sign-table" width="100%" cellPadding={0} cellSpacing={0} style={{ border: '1px solid #000', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ ...signBase, textAlign: 'center', padding: '6px 12px 2px', width: '33%', fontSize: 12 }}>pengantar,</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '6px 12px 2px', width: '34%', fontSize: 12 }}>Persetujuan,</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '6px 12px 2px', width: '33%', fontSize: 12 }}>Penerima,</td>
          </tr>
          <tr>
            <td className="print-sign-space" colSpan={3} style={{ padding: '16px 0' }}>&nbsp;</td>
          </tr>
          <tr>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 12px 2px', fontSize: 12, fontWeight: 600 }}>(_______________)</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 12px 2px', fontSize: 12, fontWeight: 600 }}>(_______________)</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 12px 2px', fontSize: 12, fontWeight: 600 }}>(_______________)</td>
          </tr>
          <tr>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 12px 6px', fontSize: 13, fontWeight: 900 }}>Driver</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 12px 6px', fontSize: 13, fontWeight: 900 }}>SPV Gudang</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 12px 6px', fontSize: 13, fontWeight: 900 }}>SPV Cabang</td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default function PrintFormModal({
  open,
  title,
  orderId,
  idCabang,
  tanggalCetak,
  nomorOrder,
  statusOrder,
  items,
  stokLookup,
  showStatus,
  onClose,
}: PrintFormProps) {
  const [busy, setBusy] = useState(false);
  const pagesRef = useRef<HTMLDivElement>(null);

  const activeItems = useMemo(
    () => items.filter((it) => String(it.itemStatus).toUpperCase() !== 'DELETED'),
    [items],
  );
  const pages = useMemo(() => {
    const chunks = chunkArray(activeItems, PRINT_ITEMS_PER_PAGE);
    return chunks.length === 0 ? [[]] : chunks;
  }, [activeItems]);
  const cabang = CABANG[idCabang];
  const pic = String(cabang?.pic || 'SUPERVISOR').toUpperCase();
  const tanggalStr = formatTanggalCetak(tanggalCetak);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        doPrint();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  const doJpg = async () => {
    setBusy(true);
    try {
      const el = pagesRef.current;
      if (!el) return;
      const pageEls = Array.from(el.querySelectorAll<HTMLElement>('.print-sheet'));
      const { downloadJpgPages } = await import('@/lib/utils');
      await downloadJpgPages(pageEls, `Form-Order-${orderId}`, (done, total) => {
        toast.info(`Memproses halaman ${done}/${total}...`);
      });
      toastSuccess('Gambar berhasil diunduh.');
    } catch (e) {
      toastError((e as Error).message || 'Gagal memproses gambar. Gunakan Print / PDF saja.');
    } finally {
      setBusy(false);
    }
  };

  // Cetak via window baru: hanya berisi form + CSS print bersih.
  // Print langsung dari modal (window.print + visibility hack) tidak andal:
  // transform dialog & scaling Chrome membuat hasil kacau.
  const doPrint = () => {
    const el = pagesRef.current;
    if (!el) return;
    const w = window.open('', '_blank', 'width=980,height=760');
    if (!w) {
      toastError('Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.');
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Form Order ${orderId}</title>
<base href="${location.href}">
<style>
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    box-sizing: border-box !important;
  }
  @page {
    size: 21cm 15.1cm;
    margin: 0;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 21cm !important;
    height: 15.1cm !important;
    background: #fff !important;
    font-family: Arial, sans-serif !important;
  }
  /* Lembar cetak tepat 21×15.1 cm, kertas tidak di-rotate */
  .print-sheet {
    position: relative !important;
    width: 21cm !important;
    height: 15.1cm !important;
    min-height: 15.1cm !important;
    max-height: 15.1cm !important;
    margin: 0 auto !important;
    padding: 0 !important;
    background: #fff !important;
    overflow: hidden !important;
    page-break-after: always !important;
    break-after: page !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    box-sizing: border-box !important;
  }
  .print-sheet:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }
  /* Form order di-rotate 90 derajat ke kiri: lebar fisik 21cm, tinggi fisik 15.1cm */
  .print-page-admin {
    position: absolute !important;
    top: 50% !important;
    left: 50% !important;
    width: 15.1cm !important;
    height: 21cm !important;
    max-width: none !important;
    min-height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 4mm 5mm !important;
    box-sizing: border-box !important;
    box-shadow: none !important;
    background: #fff !important;
    transform: translate(-50%, -50%) rotate(-90deg) !important;
    transform-origin: center center !important;
  }
  .print-kop-title {
    font-size: 26px !important;
    line-height: 1.1 !important;
    letter-spacing: -0.5px !important;
  }
  .print-kop-logo {
    width: 120px !important;
    max-width: 120px !important;
  }
  .print-info-table {
    font-size: 11.5px !important;
    margin-bottom: 6px !important;
  }
  .print-info-table td {
    padding: 1px 0 !important;
    font-size: 11.5px !important;
  }
  .print-info-table .info-col-label {
    width: 110px !important;
  }
  .print-items-table {
    width: 100% !important;
    border-collapse: collapse !important;
    margin-bottom: 8px !important;
  }
  .print-items-table th {
    font-size: 10.5px !important;
    padding: 4px 3px !important;
    line-height: 1.15 !important;
  }
  .print-items-table td {
    font-size: 11.5px !important;
    padding: 4px 3px !important;
    line-height: 1.2 !important;
  }
  .print-sign-table {
    width: 100% !important;
    margin-top: 4px !important;
  }
  .print-sign-table td {
    font-size: 11px !important;
    padding: 0 4px !important;
  }
  .print-sign-space {
    padding: 14px 0 !important;
  }
  @media screen {
    body {
      background: #52525b !important;
      padding: 20px 10px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 20px !important;
      min-height: 100vh !important;
      height: auto !important;
    }
    .print-sheet {
      box-shadow: 0 8px 30px rgba(0,0,0,0.4) !important;
    }
  }
  @media print {
    html, body {
      width: 21cm !important;
      height: 15.1cm !important;
      background: #fff !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .print-sheet {
      width: 21cm !important;
      height: 15.1cm !important;
      box-shadow: none !important;
    }
  }
</style></head><body>${el.innerHTML}
<script>
  window.addEventListener('load', function () {
    // Ukuran form sudah ditetapkan 15.1×21 cm; tanpa transform scale agar struktur stabil.
    document.querySelectorAll('.print-page-admin').forEach(function (p) {
      p.style.removeProperty('--fit');
    });
    setTimeout(function () {
      try { window.print(); } catch (e) {}
    }, 400);
  });
</script>
</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    // Print otomatis di-trigger script di window baru setelah auto-fit selesai
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="print-modal-root max-h-[90vh] max-w-4xl overflow-y-auto bg-white">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-base text-black">
              {title}
              {pages.length > 1 ? ` (${pages.length} halaman)` : ''}
            </DialogTitle>
            <p className="text-[11px] font-medium text-gray-500">
              Kertas 21×15,1 cm · form auto-fit (lebar fisik 21 cm, tinggi fisik 15,1 cm)
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doJpg}
              disabled={busy}
              style={{
                background: 'linear-gradient(135deg, #16a34a, #15803d)',
                color: '#fff',
                border: 0,
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
                opacity: busy ? 0.7 : 1,
              }}
            >
              <Icon name="download" size={16} />
              {busy ? 'Proses...' : pages.length > 1 ? `Download ${pages.length} JPG` : 'Download JPG'}
            </button>
            <button
              type="button"
              onClick={() => doPrint()}
              style={{
                background: showStatus
                  ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                  : 'linear-gradient(135deg, #ff6b00, #ff8c38)',
                color: '#fff',
                border: 0,
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
            >
              <Icon name="download" size={16} />
              Print / PDF
            </button>
            <Button size="icon" variant="ghost" onClick={onClose} className="text-black">
              <Icon name="circle-xmark" size={16} />
            </Button>
          </div>
        </DialogHeader>

        <div ref={pagesRef} id="printPagesContainer" className="space-y-4">
          {pages.map((pageItems, i) =>
            buildPage(pageItems, {
              pic,
              nomor: nomorOrder,
              tanggal: tanggalStr,
              pageLabel: pages.length > 1 ? `${i + 1} / ${pages.length}` : '',
              statusOrder: showStatus ? statusOrder : undefined,
              stokLookup,
            }),
          )}
        </div>

        {/* CSS print berada di window cetak (doPrint) — print dari modal tidak andal */}
      </DialogContent>
    </Dialog>
  );
}