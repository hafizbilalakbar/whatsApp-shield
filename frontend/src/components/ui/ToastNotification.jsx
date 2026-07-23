import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './cn';

const variants = {
  info: { bg: 'bg-blue-500/10 border-blue-500/30 text-blue-500', icon: Info },
  success: { bg: 'bg-success/10 border-success/30 text-success', icon: CheckCircle },
  warning: { bg: 'bg-warning/10 border-warning/30 text-warning', icon: AlertTriangle },
  error: { bg: 'bg-error/10 border-error/30 text-error', icon: AlertCircle },
};

export function showToast(message, type = 'info', duration = 3500) {
  window.dispatchEvent(new CustomEvent('ws-toast', { detail: { message, type, duration } }));
}

function ToastItem({ id, message, type, duration, onDismiss }) {
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());
  const frameRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        onDismiss(id);
      } else {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [duration, id, onDismiss]);

  const v = variants[type] || variants.info;
  const Icon = v.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 120, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 120, scale: 0.95 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      className={cn(
        'relative overflow-hidden rounded-xl border shadow-xl backdrop-blur-sm min-w-[300px] max-w-[420px] pointer-events-auto',
        v.bg
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon size={20} className="shrink-0 mt-0.5" />
        <p className="text-sm flex-1 leading-relaxed">{message}</p>
        <button onClick={() => onDismiss(id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X size={16} />
        </button>
      </div>
      <div className="h-1 bg-border/50">
        <div
          className="h-full transition-none rounded-full"
          style={{ width: `${progress}%`, backgroundColor: 'currentColor', opacity: 0.4 }}
        />
      </div>
    </motion.div>
  );
}

export function ToastContainer({ isAuthenticated }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!isAuthenticated) return;
      const { message, type, duration } = e.detail;
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, message, type, duration }]);
    };
    window.addEventListener('ws-toast', handler);
    return () => window.removeEventListener('ws-toast', handler);
  }, [isAuthenticated]);

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-3 pointer-events-none" style={{ maxHeight: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      <AnimatePresence>
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem {...t} onDismiss={removeToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
