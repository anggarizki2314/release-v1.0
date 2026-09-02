import { useEffect, useState } from 'react';
import './ComingSoonToast.css';

interface ComingSoonToastProps {
  message: string;
  visible: boolean;
  onClose: () => void;
}

export default function ComingSoonToast({ message, visible, onClose }: ComingSoonToastProps) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (visible) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setAnimating(false);
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
    setAnimating(false);
  }, [visible, onClose]);

  if (!visible && !animating) return null;

  return (
    <div className={`coming-soon-toast ${visible ? 'coming-soon-toast--visible' : 'coming-soon-toast--hiding'}`}>
      <div className="coming-soon-toast__icon">✦</div>
      <div className="coming-soon-toast__content">
        <div className="coming-soon-toast__title">Coming Soon</div>
        <div className="coming-soon-toast__message">{message}</div>
      </div>
      <button className="coming-soon-toast__close" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
  );
}
