import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ChevronDown } from 'lucide-react';
import { reassureursApi } from '../../api/master-data.api';
import { ReassureurBankAccount, CreateReassureurBankAccountDto, getSwiftWarning } from '../../types/reassureur.types';
import { CURRENCIES } from '../../data/currencies';

interface ReassureurBankAccountModalProps {
  reassureurId: string;
  resident: boolean;
  existingBankAccounts: ReassureurBankAccount[];
  bankAccount: ReassureurBankAccount | null;
  onClose: () => void;
}

interface BankAccountFormData {
  banque: string;
  agence: string;
  rib: string;
  iban: string;
  swift: string;
  currency: string;
  isDefault: boolean;
}

function CurrencySelect({ value, onChange, hasError }: { value: string; onChange: (v: string) => void; hasError: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const filtered = CURRENCIES.filter(
    (c) => c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase())
  );
  const selected = CURRENCIES.find((c) => c.code === value);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setOpen((v) => !v); setSearch(''); }}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border ${
          hasError ? 'border-destructive' : 'border-border'
        } bg-secondary text-[13px] outline-none transition focus:ring-2 focus:ring-primary/20`}>
        <span className={selected ? 'text-foreground' : 'text-muted-foreground/70'}>
          {selected ? `${selected.code} — ${selected.name}` : 'Sélectionner une devise...'}
        </span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (code ou nom)..."
              className="w-full px-2 py-1.5 text-[12px] rounded-lg border border-border bg-secondary text-foreground outline-none transition focus:ring-2 focus:ring-primary/20" />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-muted-foreground/70">Aucun résultat</li>
            ) : filtered.map((c) => (
              <li key={c.code} onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
                className={`px-3 py-2 text-[12px] cursor-pointer hover:bg-primary/10 flex items-center gap-2 ${
                  c.code === value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                }`}>
                <span className="font-mono font-semibold w-10 shrink-0">{c.code}</span>
                <span className="text-muted-foreground">{c.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ReassureurBankAccountModal({
  reassureurId,
  resident,
  existingBankAccounts,
  bankAccount,
  onClose,
}: ReassureurBankAccountModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<BankAccountFormData>(() => {
    if (bankAccount) {
      return {
        banque: bankAccount.banque || '',
        agence: bankAccount.agence || '',
        rib: bankAccount.rib || '',
        iban: bankAccount.iban || '',
        swift: bankAccount.swift || '',
        currency: bankAccount.currency || '',
        isDefault: bankAccount.isDefault || false,
      };
    }
    return {
      banque: '',
      agence: '',
      rib: '',
      iban: '',
      swift: '',
      currency: resident ? 'TND' : 'EUR',
      isDefault: existingBankAccounts.length === 0,
    };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (nextAccounts: CreateReassureurBankAccountDto[]) =>
      reassureursApi.update(reassureurId, { bankAccounts: nextAccounts }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reassureurs', reassureurId] });
      onClose();
    },
    onError: (error: any) => {
      setErrors({ submit: error.response?.data?.message || "Erreur lors de l'enregistrement du compte bancaire." });
    },
  });

  // Non-blocking, matches the backend's own MISSING_SWIFT_NON_RESIDENT audit-log
  // flag philosophy (ReassureursService.create()/update()) — displayed as a warning,
  // never prevents submission.
  const swiftWarning = getSwiftWarning(formData.swift || undefined, resident);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!formData.banque.trim()) {
      setErrors({ banque: 'La banque est obligatoire' });
      return;
    }
    if (!formData.rib.trim()) {
      setErrors({ rib: 'Le RIB est obligatoire' });
      return;
    }
    if (!formData.currency) {
      setErrors({ currency: 'La devise est obligatoire' });
      return;
    }

    const toDto = (b: ReassureurBankAccount): CreateReassureurBankAccountDto => ({
      banque: b.banque,
      agence: b.agence,
      rib: b.rib,
      iban: b.iban,
      swift: b.swift,
      currency: b.currency,
      isDefault: b.isDefault,
    });

    const editedDto: CreateReassureurBankAccountDto = { ...formData };

    let nextAccounts: CreateReassureurBankAccountDto[];
    if (bankAccount) {
      nextAccounts = existingBankAccounts.map((b) => {
        if (b.id === bankAccount.id) return editedDto;
        const dto = toDto(b);
        return editedDto.isDefault ? { ...dto, isDefault: false } : dto;
      });
    } else {
      const rest = existingBankAccounts.map((b) => {
        const dto = toDto(b);
        return editedDto.isDefault ? { ...dto, isDefault: false } : dto;
      });
      nextAccounts = [...rest, editedDto];
    }

    mutation.mutate(nextAccounts);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      const nextValue = name === 'swift' ? value.toUpperCase() : value;
      setFormData((prev) => ({ ...prev, [name]: nextValue }));
    }
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  return (
    <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl border border-border bg-card shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {bankAccount ? 'Modifier le compte bancaire' : 'Nouveau compte bancaire'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errors.submit && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-[13px] text-destructive">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                Banque <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="banque"
                value={formData.banque}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 rounded-xl border ${errors.banque ? 'border-destructive' : 'border-border'} bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20`}
              />
              {errors.banque && <p className="mt-1 text-[11px] text-destructive">{errors.banque}</p>}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Agence</label>
              <input
                type="text"
                name="agence"
                value={formData.agence}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-border bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                RIB <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="rib"
                value={formData.rib}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 rounded-xl border ${errors.rib ? 'border-destructive' : 'border-border'} bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20`}
              />
              {errors.rib && <p className="mt-1 text-[11px] text-destructive">{errors.rib}</p>}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">IBAN</label>
              <input
                type="text"
                name="iban"
                value={formData.iban}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl border border-border bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                SWIFT / BIC
                {!resident && <span className="text-warning ml-1">(généralement requis)</span>}
              </label>
              <input
                type="text"
                name="swift"
                value={formData.swift}
                onChange={handleChange}
                placeholder="ex: BNPAFRPPXXX"
                className="w-full px-3 py-2 rounded-xl border border-border bg-secondary text-foreground text-[13px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {/* FIX: non-blocking warning, matches getSwiftWarning()'s documented
                  intent — informs, never prevents submission (Question 5.6.3 is
                  still open with the client; the backend itself only logs an
                  audit-trail flag, it never rejects). */}
              {swiftWarning && (
                <p className="mt-1 text-[11px] text-warning">{swiftWarning}</p>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                Devise <span className="text-destructive">*</span>
              </label>
              <CurrencySelect
                value={formData.currency}
                onChange={(val) => {
                  setFormData((prev) => ({ ...prev, currency: val }));
                  if (errors.currency) setErrors((prev) => ({ ...prev, currency: '' }));
                }}
                hasError={!!errors.currency}
              />
              {errors.currency && <p className="mt-1 text-[11px] text-destructive">{errors.currency}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleChange}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary/20"
                />
                <span className="text-[13px] font-medium text-muted-foreground">Compte principal</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary/60 rounded-xl transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}