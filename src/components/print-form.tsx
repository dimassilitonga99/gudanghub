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

export const PRINT_ITEMS_PER_PAGE = 20;

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
    if (st === 'PENDING' || st === 'PICKED')
      return <span style={{ background: '#f59e0b', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 700 }}>MENUNGGU</span>;
    if (st === 'APPROVED')
      return <span style={{ background: '#16a34a', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 700 }}>DISETUJUI</span>;
    if (st === 'REJECTED')
      return <span style={{ background: '#dc2626', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 13, fontWeight: 700 }}>DITOLAK</span>;
    return null;
  })();

  const cell: React.CSSProperties = {
    border: '1px solid #000',
    padding: '5px 4px',
    textAlign: 'center',
    fontSize: 15,
    fontFamily: 'Arial, sans-serif',
    fontWeight: 'bold',
  };
  const headerCell: React.CSSProperties = { ...cell, fontSize: 13, fontWeight: 800, background: '#B4D6F0' };

  return (
    <div
      className="print-page-admin"
      style={{
        background: '#fff',
        color: '#000',
        width: '100%',
        maxWidth: 850,
        margin: '0 auto',
        padding: 20,
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
        pageBreakAfter: 'always',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Kop */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: 1 }}>
            <span style={{ color: '#ff6b00' }}>FORM </span>
            <span style={{ color: '#3b82f6' }}>ORDER BARANG</span>
          </div>
        </div>
        <img
          src="./images/logo/logo-nk.png"
          alt="logo"
          style={{ width: 140 }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
      <hr style={{ border: 'none', borderTop: '2px solid #000', margin: '4px 0 10px' }} />

      {/* Info */}
      <div style={{ fontSize: 14, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div>
          <div>
            <b>DIBUAT OLEH :</b> {info.pic}
          </div>
          <div>
            <b>NOMOR ORDER :</b> {info.nomor}
            {info.pageLabel && (
              <span style={{ background: '#ff6b00', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, marginLeft: 8 }}>
                HALAMAN {info.pageLabel}
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div>
            <b>Hari/Tgl :</b> {info.tanggal}
          </div>
          {info.statusOrder && (
            <div style={{ marginTop: 4 }}>
              <b>STATUS ORDER : </b>
              {statusBadge}
            </div>
          )}
        </div>
      </div>

      {/* Tabel item */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr>
            <th style={headerCell}>STOCK SISTEM</th>
            <th style={headerCell}>STOCK (Gudang)</th>
            <th style={headerCell}>STOCK (Rak)</th>
            <th style={headerCell}>JMLH ORDER</th>
            <th style={headerCell}>KODE ITEM</th>
            <th style={headerCell}>NAMA ITEM</th>
            <th style={headerCell}>JENIS</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((it) => {
            const stokSistem =
              it.stokSistem !== '' ? toInt(it.stokSistem) : toInt(info.stokLookup?.(it.kode) ?? 0);
            return (
              <tr key={it.kode + it.qty}>
                <td style={cell}>{stokSistem}</td>
                <td style={cell}>{it.stokGudang === '' ? '0' : it.stokGudang}</td>
                <td style={cell}>{it.stokToko === '' ? '0' : it.stokToko}</td>
                <td style={{ ...cell, color: '#00B050', fontWeight: 800 }}>
                  {it.qty} {String(it.satuan || 'PCS').toUpperCase()}
                </td>
                <td style={{ ...cell, fontSize: 13 }}>{it.kode}</td>
                <td style={{ ...cell, fontSize: 13 }}>
                  {String(it.nama || '').toUpperCase()}
                  {it.catatanItem ? (
                    <span style={{ color: '#dc2626', fontStyle: 'italic', fontWeight: 'bold' }}>
                      {' '}
                      ({it.catatanItem})
                    </span>
                  ) : null}
                </td>
                <td style={{ ...cell, fontSize: 13, fontWeight: 800 }}>
                  {String(it.kategori || 'ELEKTRONIK').toUpperCase()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Tanda tangan */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 24, tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            {['pengantar,', 'Persetujuan,', 'Penerima,'].map((label) => (
              <td key={label} style={{ ...cell, textAlign: 'left', verticalAlign: 'bottom', height: 90 }}>
                <div style={{ fontSize: 12, fontWeight: 'normal' }}>{label}</div>
                <div style={{ marginTop: 40, fontSize: 13 }}>(________________)</div>
              </td>
            ))}
          </tr>
          <tr>
            {['Driver', 'SPV Gudang', 'SPV Cabang'].map((role) => (
              <td
                key={role}
                style={{
                  border: '1px solid #000',
                  padding: '5px 4px',
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  background: '#fff',
                }}
              >
                {role}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
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
  const pages = useMemo(
    () => chunkArray(activeItems, PRINT_ITEMS_PER_PAGE),
    [activeItems],
  );
  const cabang = CABANG[idCabang];
  const pic = String(cabang?.pic || 'SUPERVISOR').toUpperCase();
  const tanggalStr = formatTanggalCetak(tanggalCetak);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
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

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="print-modal-root max-h-[90vh] max-w-4xl overflow-y-auto bg-white">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-base text-black">
            {title}
            {pages.length > 1 ? ` (${pages.length} halaman)` : ''}
          </DialogTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={doJpg}
              disabled={busy}
              className="text-black"
            >
              <Icon name="download" size={16} />
              {busy ? 'Proses...' : pages.length > 1 ? `Download ${pages.length} JPG` : 'Download JPG'}
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Icon name="print" size={16} />
              Print / PDF
            </Button>
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

        <style>{`
          @media print {
            body * { visibility: hidden; }
            .print-page-admin, .print-page-admin * { visibility: visible; }
            .print-modal-root {
              position: static !important;
              max-width: 100% !important;
              max-height: none !important;
              overflow: visible !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              background: #fff !important;
            }
            .print-page-admin {
              position: static !important;
              max-width: 100% !important;
              box-shadow: none !important;
              margin: 0 auto !important;
              page-break-after: always !important;
            }
            .print-page-admin:last-child { page-break-after: auto !important; }
            @page { size: A4; margin: 10mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}