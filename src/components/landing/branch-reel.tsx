"use client";

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { HaloReel } from '@/components/ui/halo-reel';
import { CABANG_LIST } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';

const HOLD_MS = 1000;
const STEP_MS = 700;

export function BranchReel() {
  const reduceMotion = useReducedMotion();
  const [frontIndex, setFrontIndex] = useState(0);

  // Highlight label bergilir mengikuti ritme autoplay HaloReel.
  useEffect(() => {
    if (reduceMotion) return;
    const t = window.setInterval(() => {
      setFrontIndex((i) => (i + 1) % CABANG_LIST.length);
    }, HOLD_MS + STEP_MS);
    return () => window.clearInterval(t);
  }, [reduceMotion]);

  if (reduceMotion) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CABANG_LIST.map((cabang) => (
          <Link
            key={cabang.id}
            to={`/login?branch=${cabang.id}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <img
              src={`./images/cabang/${cabang.id.toLowerCase()}.jpg`}
              alt={cabang.nama}
              loading="lazy"
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <div className="truncate font-semibold">{cabang.nama}</div>
              <div className="text-sm text-muted-foreground">PIC: {cabang.pic}</div>
              <div className="truncate text-xs text-muted-foreground">{cabang.alamat}</div>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[1fr_280px]">
      <HaloReel
        aria-label="Pilih cabang toko"
        items={CABANG_LIST.map((c) => ({
          src: `./images/cabang/${c.id.toLowerCase()}.jpg`,
          alt: c.nama,
          title: c.nama,
          subtitle: `PIC ${c.pic}`,
          bgColor: c.color,
          textColor: '#fff',
        }))}
        className="h-[420px] sm:h-[520px]"
        cardWidth={200}
        cardHeight={260}
        centerXRatio={0.1}
        holdDuration={HOLD_MS}
        stepDuration={STEP_MS}
        centerLabel={null}
        showCenterLabel={false}
      />
      <ul className="space-y-2">
        {CABANG_LIST.map((cabang, i) => (
          <li key={cabang.id}>
            <Link
              to={`/login?branch=${cabang.id}`}
              onMouseEnter={() => setFrontIndex(i)}
              onFocus={() => setFrontIndex(i)}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                i === frontIndex
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: cabang.color }}
              >
                {cabang.pic.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{cabang.nama}</span>
                <span className="block text-xs text-muted-foreground">
                  PIC: {cabang.pic} · {cabang.alamat}
                </span>
              </span>
              <Icon name="arrow-up-right" size={14} className="shrink-0 text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
