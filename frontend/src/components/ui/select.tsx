import * as React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

const SelectContext = React.createContext<{ value: string; onValueChange: (value: string) => void; open: boolean; setOpen: (open: boolean) => void } | undefined>(undefined);

export function Select({ value, onValueChange, children, defaultValue, disabled }: { value?: string; onValueChange?: (value: string) => void; children: React.ReactNode; defaultValue?: string; disabled?: boolean }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || '');
  const [open, setOpen] = React.useState(false);
  const currentValue = value !== undefined ? value : internalValue;
  const handleChange = (newValue: string) => {
    if (disabled) return;
    if (value === undefined) setInternalValue(newValue);
    onValueChange?.(newValue);
    setOpen(false);
  };
  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ children, className, disabled }: { children: React.ReactNode; className?: string; disabled?: boolean }) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectTrigger must be used within Select');
  return (
    <button
      type="button"
      onClick={() => !disabled && context.setOpen(!context.open)}
      disabled={disabled}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground/70 transition-colors focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {children}
      <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within Select');
  return <span>{context.value || placeholder}</span>;
}

export function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectContent must be used within Select');
  if (!context.open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={() => context.setOpen(false)} />
      <div className={cn('absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg', className)}>
        {children}
      </div>
    </>
  );
}

export function SelectItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectItem must be used within Select');
  return (
    <div
      onClick={() => context.onValueChange(value)}
      className={cn(
        'relative flex cursor-pointer select-none items-center px-3 py-2 text-sm text-foreground outline-none transition-colors hover:bg-secondary/60 focus:bg-secondary/60',
        context.value === value && 'bg-primary/10 font-medium text-accent-foreground',
        className
      )}
    >
      {children}
    </div>
  );
}