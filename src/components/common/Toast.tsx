import React, { useEffect } from 'react';

interface Props {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<Props> = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 ${bgColors[type]} text-white px-6 py-3 rounded-full shadow-2xl z-[1000] flex items-center gap-2 animate-bounce-short`}>
      <span className="text-sm font-bold">{message}</span>
      <button onClick={onClose} className="hover:opacity-70">×</button>
    </div>
  );
};
