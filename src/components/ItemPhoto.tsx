import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { katalog } from '@/lib/api';

// Cache gambar barang per sesi — hindari fetch berulang antar halaman
export const gambarCache = new Map<string, string>();

/**
 * Ambil dataURL gambar barang dari Sheet (kolom GAMBAR).
 * Request hanya ditembakkan saat elemen anchor mendekati viewport
 * (IntersectionObserver, buffer 400px). Pasang ref pada elemen render.
 * `done` = true setelah pengecekan selesai (dipakai untuk fallback statis).
 */
export function useGambar(kode: string): {
  src: string;
  ref: RefObject<HTMLDivElement>;
  done: boolean;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState(() => gambarCache.get(kode) || '');
  const [done, setDone] = useState(() => gambarCache.has(kode));

  useEffect(() => {
    if (gambarCache.has(kode)) {
      setSrc(gambarCache.get(kode)!);
      setDone(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    let alive = true;

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        io.disconnect();
        katalog
          .getGambar(kode)
          .then((res) => {
            if (res.status === 'ok' && res.data) {
              const gambar = String((res.data as { gambar?: string }).gambar || '');
              if (gambar) {
                gambarCache.set(kode, gambar);
                if (alive) setSrc(gambar);
              }
            }
          })
          .catch(() => undefined)
          .finally(() => {
            if (alive) setDone(true);
          });
      },
      { rootMargin: '400px' },
    );

    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [kode]);

  return { src, ref, done };
}

/** Kartu admin: Sheet dulu → fallback gambar statis images/produk/KODE.webp → ikon placeholder. */
export function BarangImage({ kode }: { kode: string }) {
  const { src, ref, done } = useGambar(kode.toUpperCase());
  const [staticFailed, setStaticFailed] = useState(false);
  const upperKode = kode.toUpperCase();
  const showStatic = !src && done && !staticFailed;

  return (
    <div ref={ref} className="absolute inset-0">
      {src ? (
        <img
          src={src}
          alt={upperKode}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : showStatic ? (
        <img
          src={`./images/produk/${upperKode}.webp`}
          alt={upperKode}
          loading="lazy"
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          onError={() => setStaticFailed(true)}
        />
      ) : null}
    </div>
  );
}
