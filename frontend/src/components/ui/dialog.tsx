import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { lockBodyScroll, unlockBodyScroll } from '../../lib/scroll-lock';

export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    // lock scroll when this dialog mounts
    lockBodyScroll();
    return () => {
      // unlock on unmount
      unlockBodyScroll();
      setMounted(false);
    };
  }, []);

  if (!open || !mounted) return null;

  const overlay = (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      {children}
    </div>
  );

  return createPortal(overlay, document.body);
}

export function DialogContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('relative z-[100000] bg-white rounded-lg shadow-lg p-6', className)}>{children}</div>;
}

export function DialogHeader({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left mb-4', className)}>{children}</div>;
}

export function DialogTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h2 className={cn('text-lg font-semibold leading-none tracking-tight', className)}>{children}</h2>;
}
