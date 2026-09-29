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

// Kertas cetak 21×14,5 cm landscape — 7 baris/halaman agar kop+tabel+ttd muat utuh
export const PRINT_ITEMS_PER_PAGE = 7;

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
    padding: '5px 4px',
    border: '1px solid #000',
    fontFamily: 'Arial, sans-serif',
    fontSize: 15,
    fontWeight: 700,
    verticalAlign: 'middle',
    textAlign: 'center',
    lineHeight: 1.2,
  };
  const headerCell = (w?: number): React.CSSProperties => ({
    padding: '6px 4px',
    border: '1px solid #000',
    fontFamily: 'Arial, sans-serif',
    fontSize: 13,
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
    <div className="print-sheet">
    <div
      className="print-page-admin"
      style={{
        background: '#fff',
        color: '#000',
        padding: '28px 32px',
        maxWidth: 850,
        margin: '0 auto 24px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        minHeight: 500,
        pageBreakAfter: 'always',
      }}
    >
      {/* KOP */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', marginBottom: 0 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: 'top', paddingBottom: 10, paddingTop: 2 }}>
              <div className="print-kop-title" style={{ fontFamily: 'Arial, sans-serif', fontSize: 38, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>
                <span style={{ color: '#E67E22' }}>FORM</span>
                <span style={{ color: '#1B4F94' }}> ORDER BARANG</span>
              </div>
            </td>
            <td style={{ verticalAlign: 'top', textAlign: 'right', width: 170, paddingBottom: 10 }}>
              <img
                className="print-kop-logo"
                src="./images/logo/logo-nk.png"
                alt="Logo Nasional Kitchen"
                style={{ width: 140, height: 'auto', display: 'block', marginLeft: 'auto' }}
                crossOrigin="anonymous"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ borderTop: '1px solid #000', marginBottom: 8 }} />

      {/* INFO */}
      <table className="print-info-table" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', marginBottom: 10, fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#000' }}>
        <tbody>
          <tr>
            <td className="info-col-label" style={{ padding: '2px 0', width: 150, fontWeight: 700, verticalAlign: 'top' }}>DIBUAT OLEH</td>
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
      <table className="print-items-table" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', border: '1px solid #000', marginBottom: 20 }}>
        <thead>
          <tr style={{ background: '#B4D6F0' }}>
            <th style={headerCell(52)}>STOCK<br />SISTEM</th>
            <th style={headerCell(52)}>STOCK<br />(Gudang)</th>
            <th style={headerCell(46)}>STOCK<br />(Rak)</th>
            <th style={headerCell(54)}>JMLH<br />ORDER</th>
            <th style={headerCell(68)}>KODE ITEM</th>
            <th style={headerCell()}>NAMA ITEM</th>
            <th style={headerCell(68)}>JENIS</th>
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
                <td style={{ ...cell, padding: '5px 8px', fontSize: 13 }}>{it.kode}</td>
                <td style={{ ...cell, padding: '5px 8px', fontSize: 13, lineHeight: 1.3 }}>
                  {String(it.nama || '').toUpperCase()}
                  {it.catatanItem ? (
                    <span style={{ color: '#DC2626', fontWeight: 800, fontStyle: 'italic' }}>
                      {' '}({it.catatanItem})
                    </span>
                  ) : null}
                </td>
                <td style={{ ...cell, padding: '5px 6px', fontSize: 13, fontWeight: 800 }}>
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
            <td style={{ ...signBase, textAlign: 'center', padding: '12px 20px 3px', width: '33%', fontSize: 13 }}>pengantar,</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '12px 20px 3px', width: '34%', fontSize: 13 }}>Persetujuan,</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '12px 20px 3px', width: '33%', fontSize: 13 }}>Penerima,</td>
          </tr>
          <tr>
            <td className="print-sign-space" colSpan={3} style={{ padding: '25px 0' }}>&nbsp;</td>
          </tr>
          <tr>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 20px 3px', fontSize: 13, fontWeight: 600 }}>(_______________)</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 20px 3px', fontSize: 13, fontWeight: 600 }}>(_______________)</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 20px 3px', fontSize: 13, fontWeight: 600 }}>(_______________)</td>
          </tr>
          <tr>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 20px 12px', fontSize: 14, fontWeight: 900 }}>Driver</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 20px 12px', fontSize: 14, fontWeight: 900 }}>SPV Gudang</td>
            <td style={{ ...signBase, textAlign: 'center', padding: '0 20px 12px', fontSize: 14, fontWeight: 900 }}>SPV Cabang</td>
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
      const pageEls = Array.from(el.querySelectorAll<HTMLElement>('.print-page-admin'));
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
    size: 14.5cm 21cm;
    margin: 0;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    background: #fff !important;
    font-family: Arial, sans-serif !important;
  }
  /* Lembar cetak: tepat 14.5cm lebar (portrait), margin 0 */
  .print-sheet {
    width: 14.5cm !important;
    max-width: 14.5cm !important;
    margin: 0 auto;
    padding: 0 !important;
    background: #fff !important;
    page-break-after: always;
    break-after: page;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }
  .print-sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  /* Form menempel di pojok kiri atas, lebar 100% kertas, margin 0, tanpa tepi/border */
  .print-page-admin {
    width: 14.5cm !important;
    max-width: 14.5cm !important;
    min-height: 0 !important;
    height: auto !important;
    margin: 0 !important;
    padding: 2.5mm 3.5mm !important;
    box-shadow: none !important;
    background: #fff !important;
    transform: none !important;
    box-sizing: border-box !important;
  }
  .print-kop-title {
    font-size: 22px !important;
    line-height: 1.1 !important;
    letter-spacing: -0.5px !important;
  }
  .print-kop-logo {
    width: 105px !important;
    max-width: 105px !important;
  }
  .print-info-table {
    font-size: 10.5px !important;
    margin-bottom: 5px !important;
  }
  .print-info-table td {
    padding: 1px 0 !important;
    font-size: 10.5px !important;
  }
  .print-info-table .info-col-label {
    width: 95px !important;
  }
  .print-items-table {
    width: 100% !important;
    border-collapse: collapse !important;
    margin-bottom: 8px !important;
  }
  .print-items-table th {
    font-size: 9.5px !important;
    padding: 3px 2px !important;
    line-height: 1.15 !important;
  }
  .print-items-table td {
    font-size: 10.5px !important;
    padding: 3px 2px !important;
    line-height: 1.2 !important;
  }
  .print-sign-table {
    width: 100% !important;
    margin-top: 4px !important;
  }
  .print-sign-table td {
    font-size: 10px !important;
    padding: 0 4px !important;
  }
  .print-sign-space {
    padding: 10px 0 !important;
  }
  @media screen {
    body {
      background: #52525b !important;
      padding: 16px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 16px !important;
    }
    .print-sheet {
      box-shadow: 0 6px 24px rgba(0,0,0,0.35) !important;
      min-height: 21cm !important;
    }
  }
  @media print {
    body {
      background: #fff !important;
      padding: 0 !important;
    }
    .print-sheet {
      width: 100% !important;
      max-width: 100% !important;
      min-height: 100% !important;
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .print-page-admin {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  }
</style></head><body>${el.innerHTML}
<script>
  window.addEventListener('load', function () {
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
              Kertas portrait 14,5×21 cm · form lurus + auto-fit
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