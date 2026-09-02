/**
 * Trading Engine 2.0 — ToastNotification
 * Bottom-right visual feedback component displaying transient toasts (e.g. "Order Created").
 * Auto-dismisses after 2000ms.
 */

import React, { useEffect } from 'react';
import './ToastNotification.css';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

export interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts, onDismiss }) => {
  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = setTimeout(() => {
      onDismiss(toasts[0].id);
    }, 2000);

    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="te2-toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`te2-toast-item ${t.type ?? 'success'}`}>
          <span>{t.type === 'error' ? '❌' : t.type === 'warning' ? '⚠️' : '✅'}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
};
