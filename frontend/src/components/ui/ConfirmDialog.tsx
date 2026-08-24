import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="w-full max-w-md rounded-2xl border border-border p-0 overflow-hidden">
        <div className="p-5">
          <DialogHeader className="mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-warning/25 bg-warning/15 text-warning">
                <AlertTriangle size={18} />
              </div>
              <DialogTitle className="font-display text-base text-foreground">{title}</DialogTitle>
            </div>
          </DialogHeader>
          <p className="text-[13px] leading-6 text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-secondary/40 px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-xl px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              confirmVariant === 'danger'
                ? 'border-destructive-border bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive'
                : 'border-primary-border bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}