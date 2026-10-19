import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import masterDataApi from '../../api/master-data.api';
import { CreateAssureDto } from '../../types/assure.types';
import { CreateCedanteDto } from '../../types/cedante.types';
import { CreateReassureurDto } from '../../types/reassureur.types';
import CountrySelect from '../../components/ui/CountrySelect';
import CurrencySelect from '../../components/ui/CurrencySelect';

type ReferenceKind = 'assure' | 'cedante' | 'reassureur';

type Props = {
  kind: ReferenceKind;
  onClose: () => void;
  onCreated: (entity: { id: string; raisonSociale: string; code?: string }) => void;
};

const fieldClass =
  'w-full rounded-xl border border-border bg-secondary px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary';
const labelClass = 'block text-[12px] font-medium text-muted-foreground mb-1.5';

const labels: Record<ReferenceKind, string> = {
  assure: 'un assuré',
  cedante: 'une cédante',
  reassureur: 'un réassureur',
};

export default function QuickReferenceCreateModal({ kind, onClose, onCreated }: Props) {
  const [raisonSociale, setRaisonSociale] = useState('');
  const [compteComptable, setCompteComptable] = useState('');
  const [resident, setResident] = useState(kind === 'cedante');
  const [identifiantUnique, setIdentifiantUnique] = useState('');
  const [formeJuridique, setFormeJuridique] = useState('');
  const [rne, setRne] = useState('');
  const [adresse, setAdresse] = useState('');
  const [capital, setCapital] = useState('');
  const [pays, setPays] = useState('');
  const [deviseParDefaut, setDeviseParDefaut] = useState('TND');
  const [freeFields, setFreeFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const mutation = useMutation<unknown, unknown, void>({
    mutationFn: () => {
      if (kind === 'assure') {
        const data: CreateAssureDto = {
          raisonSociale,
          rne: rne || undefined,
          formeJuridique: formeJuridique || undefined,
          adresse: adresse || undefined,
          pays: pays || undefined,
          capital: capital ? Number(capital) : undefined,
          deviseParDefaut,
          freeFields: Object.keys(freeFields).length ? freeFields : undefined,
        };
        return masterDataApi.assures.create(data);
      }

      if (kind === 'cedante') {
        const data: CreateCedanteDto = {
          raisonSociale,
          compteComptable,
          resident,
          identifiantUnique: identifiantUnique || undefined,
          formeJuridique: formeJuridique || undefined,
          rne: rne || undefined,
          adresse: adresse || undefined,
          pays: pays || undefined,
          capital: capital ? Number(capital) : undefined,
          deviseParDefaut,
        };
        return masterDataApi.cedantes.create(data);
      }

      const data: CreateReassureurDto = {
        raisonSociale,
        compteComptable,
        resident,
        identifiantUnique: identifiantUnique || undefined,
        rne: rne || undefined,
        formeJuridique: formeJuridique || undefined,
        adresse: adresse || undefined,
        pays: pays || undefined,
        capital: capital ? Number(capital) : undefined,
        deviseParDefaut,
      };
      return masterDataApi.reassureurs.create(data);
    },
    onSuccess: (response) => onCreated((response as { data: { id: string; raisonSociale: string; code?: string } }).data),
    onError: (requestError: any) => {
      if (requestError.response?.status === 403) {
        setError(
          "Vous n'avez pas les droits nécessaires pour créer une fiche dans le Référentiel. Contactez un administrateur.",
        );
        return;
      }
      const message = requestError.response?.data?.message || 'Impossible de créer cette fiche.';
      setError(Array.isArray(message) ? message.join(', ') : message);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // This form is rendered through a portal, but React still bubbles its events
    // to the React parent — inside AffaireEditModal's <form> that triggered the
    // affaire's own submit.
    event.stopPropagation();
    setError('');
    if (!raisonSociale.trim()) {
      setError('La raison sociale est obligatoire.');
      return;
    }
    const validAccount = kind === 'cedante'
      ? /^4012[0-9]{4}$/.test(compteComptable)
      : /^4013[0-9]{4}$/.test(compteComptable);
    if (kind !== 'assure' && !validAccount) {
      setError(kind === 'cedante' ? 'Le compte doit respecter le format 4012xxxx.' : 'Le compte doit respecter le format 4013xxxx.');
      return;
    }
    if (resident && !/^[0-9]{7}[A-Z]$/.test(identifiantUnique)) {
      setError("L'identifiant unique doit contenir 7 chiffres et une lettre majuscule.");
      return;
    }
    mutation.mutate();
  };

  return createPortal(
    (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Ajouter {labels[kind]}</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">La fiche sera créée directement dans le Référentiel.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Fermer">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto p-5">
          <div>
            <label className={labelClass}>Raison sociale *</label>
            <input autoFocus value={raisonSociale} onChange={(event) => setRaisonSociale(event.target.value)} className={fieldClass} />
          </div>

          {kind !== 'assure' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Compte comptable *</label>
                <input
                  value={compteComptable}
                  onChange={(event) => setCompteComptable(event.target.value)}
                  placeholder={kind === 'cedante' ? '4012xxxx' : '4013xxxx'}
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Forme juridique</label>
                <input
                  value={formeJuridique}
                  onChange={(event) => setFormeJuridique(event.target.value)}
                  placeholder="SA, SARL..."
                  className={fieldClass}
                />
              </div>
              <div>
                <label className={labelClass}>Pays</label>
                <CountrySelect value={pays} onChange={setPays} />
              </div>
              <div>
                <label className={labelClass}>Devise par défaut</label>
                <CurrencySelect value={deviseParDefaut} onChange={setDeviseParDefaut} />
              </div>
            </div>
          )}

          {kind === 'assure' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>RNE</label>
                  <input value={rne} onChange={(event) => setRne(event.target.value)} className={fieldClass} />
                  <p className="mt-1 text-[11px] text-muted-foreground">Ancien format - optionnel pour les clients.</p>
                </div>
                <div>
                  <label className={labelClass}>Forme juridique</label>
                  <input value={formeJuridique} onChange={(event) => setFormeJuridique(event.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Adresse</label>
                <input value={adresse} onChange={(event) => setAdresse(event.target.value)} className={fieldClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Pays</label>
                  <CountrySelect value={pays} onChange={setPays} />
                </div>
                <div>
                  <label className={labelClass}>Capital (TND)</label>
                  <input type="number" min="0" step="0.001" value={capital} onChange={(event) => setCapital(event.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Devise par défaut</label>
                <CurrencySelect value={deviseParDefaut} onChange={setDeviseParDefaut} />
              </div>
              <div>
                <label className={labelClass}>Champs libres (clé/valeur)</label>
                <div className="space-y-2">
                  {Object.entries(freeFields).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <input value={key} placeholder="Nom du champ" onChange={(event) => {
                        const next = { ...freeFields };
                        delete next[key];
                        next[event.target.value] = value;
                        setFreeFields(next);
                      }} className={fieldClass} />
                      <input value={value} placeholder="Valeur" onChange={(event) => setFreeFields({ ...freeFields, [key]: event.target.value })} className={fieldClass} />
                      <button type="button" onClick={() => {
                        const next = { ...freeFields };
                        delete next[key];
                        setFreeFields(next);
                      }} className="rounded-lg px-2 text-destructive hover:bg-destructive/10" title="Supprimer le champ">X</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setFreeFields({ ...freeFields, [`champ${Object.keys(freeFields).length + 1}`]: '' })} className="text-[12px] font-medium text-primary hover:text-primary/80">+ Ajouter un champ</button>
                </div>
              </div>
            </>
          )}

          {kind === 'reassureur' && (
            <p className="rounded-lg border border-warning/25 bg-warning/10 p-3 text-[11px] text-foreground">
              Cette création rapide n'inclut pas les coordonnées bancaires. Le code SWIFT/BIC devra être
              renseigné depuis la fiche complète du Référentiel avant tout ordre de virement vers ce réassureur.
            </p>
          )}

          {(kind === 'cedante' || kind === 'reassureur') && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>RNE (legacy)</label>
                  <input value={rne} onChange={(event) => setRne(event.target.value)} placeholder="Ancien format" className={fieldClass} />
                  <p className="mt-1 text-[11px] text-muted-foreground">Ancien format, remplacé par l’identifiant unique.</p>
                </div>
                <div>
                  <label className={labelClass}>Capital (TND)</label>
                  <input type="number" min="0" step="0.001" value={capital} onChange={(event) => setCapital(event.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Adresse</label>
                <textarea value={adresse} onChange={(event) => setAdresse(event.target.value)} rows={2} className={fieldClass} />
              </div>
            </>
          )}

          {kind !== 'assure' && (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <label className="flex items-center gap-2 text-[13px] text-foreground">
                <input type="checkbox" checked={resident} onChange={(event) => setResident(event.target.checked)} className="h-4 w-4 accent-primary" />
                Résident Tunisien: {resident ? 'Oui' : 'Non'}
              </label>
              {resident && (
                <div>
                  <label className={labelClass}>Identifiant unique *</label>
                  <input value={identifiantUnique} onChange={(event) => setIdentifiantUnique(event.target.value.toUpperCase())} placeholder="1234567A" className={fieldClass} />
                </div>
              )}
            </div>
          )}

          {error && <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-[12px] text-destructive">{error}</p>}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-border p-5">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] font-medium text-foreground hover:bg-secondary">Annuler</button>
          <button type="submit" disabled={mutation.isPending} className="rounded-xl bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {mutation.isPending ? 'Création...' : 'Créer et sélectionner'}
          </button>
        </div>
      </form>
    </div>
    ),
    document.body,
  );
}
