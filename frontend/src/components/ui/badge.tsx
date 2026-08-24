import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border-primary-border hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground border-secondary-border hover:bg-secondary/70',
        destructive: 'bg-destructive/15 text-destructive border-destructive/25 hover:bg-destructive/25',
        outline: 'bg-transparent text-foreground border-border',
        success: 'bg-success/15 text-success border-success/25 hover:bg-success/25',
        warning: 'bg-warning/15 text-warning border-warning/25 hover:bg-warning/25',
        info: 'bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4)/0.3)] hover:bg-[hsl(var(--chart-4)/0.25)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}