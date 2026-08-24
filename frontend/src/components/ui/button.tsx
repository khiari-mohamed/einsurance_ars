import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-primary text-primary-foreground border border-primary-border hover:bg-primary/90': variant === 'default',
            'border border-border bg-card hover:bg-secondary/60 text-foreground': variant === 'outline',
            'hover:bg-secondary/60 text-foreground': variant === 'ghost',
            'h-10 px-4 py-2': size === 'default',
            'h-9 px-3': size === 'sm',
            'h-11 px-8': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';