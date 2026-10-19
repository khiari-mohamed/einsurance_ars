import { useEffect, useRef, useState } from 'react';
import { parseDecimalInput } from '../../lib/decimal';

interface DecimalInputProps {
  value: number | null | undefined;
  onChange: (value: number | undefined) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

// digits, spaces and separators only (the parser validates the final shape)
const ALLOWED = /^-?[\d\s\u00A0\u202F.,]*$/;
const toText = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : String(v).replace('.', ',');

export default function DecimalInput({
  value, onChange, className, placeholder, disabled, required,
}: DecimalInputProps) {
  const [text, setText] = useState<string>(toText(value));
  const lastEmitted = useRef<number | undefined>(value ?? undefined);

  // Re-sync only when the parent changed the value for a reason other than typing
  useEffect(() => {
    const incoming = value ?? undefined;
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming;
      setText(toText(incoming));
    }
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={className}
      onChange={(e) => {
        const raw = e.target.value;
        if (!ALLOWED.test(raw)) return;
        setText(raw);
        const parsed = parseDecimalInput(raw);
        lastEmitted.current = parsed;
        onChange(parsed);
      }}
    />
  );
}