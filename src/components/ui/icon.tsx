import type { CSSProperties } from 'react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Icon({ name, size = 16, className, style }: IconProps) {
  return (
    <i
      aria-hidden="true"
      className={['fi', `fi-sr-${name}`, className].filter(Boolean).join(' ')}
      style={{ fontSize: size, ...style }}
    />
  );
}

export default Icon;