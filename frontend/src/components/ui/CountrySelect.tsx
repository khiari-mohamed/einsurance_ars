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
        className={`flex items-center justify-between w-full px-3 py-2 border rounded-lg text-[13px] cursor-pointer transition-colors ${
          disabled
            ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
            : open
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Rechercher..."
              className="w-full px-2.5 py-1.5 text-[12px] border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-gray-400 text-center">Aucun résultat</li>
            ) : (
              filtered.map((country) => (
                <li
                  key={country}
                  onMouseDown={() => handleSelect(country)}
                  className={`px-3 py-1.5 text-[13px] cursor-pointer transition-colors ${
                    country === value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-900 hover:bg-gray-50'
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
