import { ReactNode, ButtonHTMLAttributes } from 'react';
import './IconButton.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string; // accessible name + tooltip text
  active?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable icon-only button with built-in tooltip and active state.
 * Used across the top bar, left toolbar, and replay control bar so
 * hover/active/focus behavior stays consistent everywhere.
 */
export default function IconButton({
  icon,
  label,
  active = false,
  size = 'md',
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn--${size} ${active ? 'is-active' : ''} ${className}`}
      aria-label={label}
      data-tooltip={label}
      {...rest}
    >
      {icon}
    </button>
  );
}
