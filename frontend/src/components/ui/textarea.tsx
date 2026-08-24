import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground ring-offset-background transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';