import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { COUNTRIES } from '../../data/countries';

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export default function CountrySelect({
  value,
  onChange,
  disabled = false,
  placeholder = 'Sélectionner ou saisir un pays...',
  className = '',
}: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    setQuery('');
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = (country: string) => {
    onChange(country);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    if (e.key === 'Enter' && filtered.length > 0) { handleSelect(filtered[0]); }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <div
        onClick={handleOpen}
        className={`flex items-center justify-between w-full px-3 py-2 rounded-xl border text-[13px] cursor-pointer transition-colors ${
          disabled
            ? 'bg-muted text-muted-foreground/70 border-border cursor-not-allowed'
            : open
            ? 'border-primary bg-card ring-1 ring-primary ring-offset-2 ring-offset-background'
            : 'bg-card border-border hover:border-secondary-border'
        }`}
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground/70'}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-muted-foreground"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown size={14} className={`text-muted-foreground/70 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="border-b border-border p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher..."
              className="w-full rounded-md border border-border bg-secondary px-2.5 py-1.5 text-[12px] text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-center text-[12px] text-muted-foreground/70">Aucun résultat</li>
            ) : (
              filtered.map((country) => (
                <li
                  key={country}
                  onMouseDown={() => handleSelect(country)}
                  className={`cursor-pointer px-3 py-1.5 text-[13px] transition-colors ${
                    country === value
                      ? 'bg-primary/10 font-medium text-accent-foreground'
                      : 'text-foreground hover:bg-secondary/60'
                  }`}
                >
                  {country}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}