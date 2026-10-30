"use client";

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface PrintItem {
  nama: string;
  qty: number;
  satuan: string;
  stokGudang: number | '';
  stokToko: number | '';
}

interface PrintSceneProps {
  items: PrintItem[];
  nomorOrder: string;
  tanggalText: string;
  cabangText: string;
  onDone: () => void;
}

export function PrintScene({ items, nomorOrder, tanggalText, cabangText, onDone }: PrintSceneProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      onDone();
    }
  }, [reduceMotion, onDone]);

  // Escape tutup scene (fokus keyboard) — klik X juga tutup via onDone.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDone]);

  if (reduceMotion) return null;

  const shown = items.slice(0, 20);
  const extra = items.length - shown.length;

  // Portal ke document.body: overlay dirender di dalam <Dialog> tapi di luar
  // <DialogContent>/<DialogPortal>, sehingga tanpa portal ia tertutup preview.
  return createPortal(
    <div
      role="dialog"
      aria-label="Mencetak form order"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="flex w-full max-w-xs flex-col items-center">
        {/* Printer */}
        <div className="relative w-full rounded-t-xl border border-border bg-card p-3 shadow-2xl">
          <button
            type="button"
            onClick={onDone}
            aria-label="Tutup"
            className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="mx-auto h-1.5 w-16 rounded-full bg-muted" />
          <div className="mt-2 text-center text-xs font-semibold text-muted-foreground">
            Mencetak Form Order No. {nomorOrder}…
          </div>
        </div>
        {/* Kertas keluar */}
        <motion.div
          className={cn('w-[92%] origin-top overflow-hidden bg-white text-black shadow-xl')}
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          transition={{ duration: Math.min(0.5 + shown.length * 0.2, 5), ease: 'linear' }}
        >
          <div className="p-3 font-mono text-[10px] leading-snug">
            <div className="text-center font-bold">FORM ORDER BARANG</div>
            <div className="text-center">
              No. {nomorOrder} · {tanggalText}
            </div>
            <div className="text-center">{cabangText}</div>
            <div className="my-1 border-t border-dashed border-black/40" />
            {shown.map((it, i) => (
              <div key={i} className="py-0.5">
                <div className="truncate font-bold">
                  {i + 1}. {it.nama}
                </div>
                <div>
                  {it.qty} {it.satuan} · G:{it.stokGudang === '' ? '-' : it.stokGudang} T:
                  {it.stokToko === '' ? '-' : it.stokToko}
                </div>
              </div>
            ))}
            {extra > 0 && <div className="italic">…+{extra} item lain di JPG</div>}
            <div className="my-1 border-t border-dashed border-black/40" />
            <div className="text-center">Total {items.length} item</div>
          </div>
        </motion.div>
      </div>
    </div>,
    document.body,
  );
}
