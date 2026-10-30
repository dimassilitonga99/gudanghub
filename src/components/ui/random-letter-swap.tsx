"use client";

import { useMemo, useState } from 'react';
import { motion, useReducedMotion, type Transition } from 'motion/react';
import { cn } from '@/lib/utils';

interface RandomLetterSwapProps {
  label: string;
  className?: string;
  staggerDuration?: number;
  transition?: Transition;
}

export function RandomLetterSwap({
  label,
  className,
  staggerDuration = 0.025,
  transition = { duration: 0.6, type: 'spring' },
}: RandomLetterSwapProps) {
  const [hovered, setHovered] = useState(false);
  const reduceMotion = useReducedMotion();

  // Urutan acak stabil per label — huruf swap bergiliran, bukan serentak.
  const order = useMemo(() => {
    const idx = label.split('').map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, [label]);

  if (reduceMotion) {
    return (
      <span className={cn('inline-block', className)} aria-label={label}>
        {label}
      </span>
    );
  }

  return (
    <motion.span
      className={cn('inline-flex overflow-hidden', className)}
      aria-label={label}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {label.split('').map((ch, i) => (
        <span key={i} className="inline-block h-[1lh] overflow-hidden" aria-hidden="true">
          <motion.span
            className="flex flex-col"
            animate={{ y: hovered ? '-50%' : '0%' }}
            transition={{ ...transition, delay: order.indexOf(i) * staggerDuration }}
          >
            <span>{ch === ' ' ? '\u00A0' : ch}</span>
            <span>{ch === ' ' ? '\u00A0' : ch}</span>
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}
