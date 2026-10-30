"use client";

import { useEffect } from 'react';
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

  if (reduceMotion) return null;

  const shown = items.slice(0, 20);
  const extra = items.length - shown.length;

  return (
    <div
      role="dialog"
      aria-label="Mencetak form order"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
    >
      <div className="flex w-full max-w-xs flex-col items-center">
        {/* Printer */}
        <div className="w-full rounded-t-xl border border-border bg-card p-3 shadow-2xl">
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
          transition={{ duration: Math.min(0.25 + shown.length * 0.12, 2.2), ease: 'linear' }}
          onAnimationComplete={() => {
            setTimeout(onDone, 450);
          }}
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
    </div>
  );
}
