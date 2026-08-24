import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye } from 'lucide-react';
import { affairesApi } from '../../api/affaires.api';
import { formatCurrency } from '../../lib/currency';
import {
  Affaire, AffaireStatut, AffaireType, statutColors, statutLabels, typeLabels,
} from '../../types/affaire.types';
import AffaireCreateModal from './AffaireCreateModal';

const LIMIT = 20;

export default function AffairesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const searchTerm = searchParams.get('search') || '';
  const statutFilter = (searchParams.get('statut') as AffaireStatut) || '';
  const typeFilter = (searchParams.get('type') as AffaireType) || '';
  const page = Number(searchParams.get('page') || '1');

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.delete('page');
    setSearchParams(params);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['affaires', searchTerm, statutFilter, typeFilter, page],
    queryFn: async () => {
      const { data } = await affairesApi.getAll({
        search: searchTerm || undefined,
        statut: statutFilter || undefined,
        type: typeFilter || undefined,
        page,
        limit: LIMIT,
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  // FIX (Affaires pass): there is no /affaires/statistics/summary endpoint on
  // the backend — the old stats bar called a route that 404'd every time.
  // Rather than fabricate a backend endpoint that wasn't reviewed/requested,
  // this derives a lightweight, honest summary from pagination metadata
  // (total count) plus per-statut counts via three cheap filtered calls.
  const { data: statutCounts } = useQuery({
    queryKey: ['affaires-statut-counts'],
    queryFn: async () => {
      const [enCotation, prevision, placement] = await Promise.all([
        affairesApi.getAll({ statut: AffaireStatut.EN_COTATION, limit: 1 }),
        affairesApi.getAll({ statut: AffaireStatut.PREVISION, limit: 1 }),
        affairesApi.getAll({ statut: AffaireStatut.PLACEMENT_REALISE, limit: 1 }),
      ]);
      return {
        enCotation: enCotation.data.total,
        prevision: prevision.data.total,
        placement: placement.data.total,
      };
    },
  });

  const affaires = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const commissionTotal = (affaire: Affaire) =>
    affaire.reassureurs.reduce((sum, r) => sum + (r.commissionArs ?? 0), 0);

  const primeAffichee = (affaire: Affaire) =>
    affaire.type === AffaireType.FACULTATIVE
      ? affaire.facultativeData?.primeCedee ?? 0
      : affaire.traiteData?.primePrevisionnelle ?? 0;

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">Affaires</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              {total} affaire{total !== 1 ? 's' : ''}
              {statutCounts && (
                <> · {statutCounts.enCotation} en cotation · {statutCounts.prevision} en prévision · {statutCounts.placement} placées</>
              )}
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-primary-border bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus size={18} />
            Nouvelle Affaire
          </button>
        </div>

        <div className="inline-flex rounded-lg bg-secondary p-0.5">
          <button
            onClick={() => updateFilter('type', '')}
            className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
              !typeFilter ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => updateFilter('type', AffaireType.FACULTATIVE)}
            className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
              typeFilter === AffaireType.FACULTATIVE ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Facultatives
          </button>
          <button
            onClick={() => updateFilter('type', AffaireType.TRAITE)}
            className={`px-4 py-2 text-[13px] font-medium rounded-md transition-colors ${
              typeFilter === AffaireType.TRAITE ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Traités
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="p-4 border-b border-border space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" size={18} />
            <input
              type="text"
              placeholder="Rechercher par numéro, assuré, cédante, référence traité..."
              value={searchTerm}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full rounded-xl border border-border bg-secondary py-2.5 pl-10 pr-4 text-[13px] text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statutFilter}
              onChange={(e) => updateFilter('statut', e.target.value)}
              className="rounded-xl border border-border bg-secondary px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(statutLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Chargement...</div>
        ) : affaires.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Aucune affaire trouvée</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">N° Affaire</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Assuré / Traité</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cédante</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Prime</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Commission ARS</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Statut</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {affaires.map((affaire: Affaire) => (
                  <tr key={affaire.id} className="transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-3 text-[13px] font-medium text-foreground font-mono">{affaire.numero}</td>
                    <td className="px-4 py-3 text-[13px]">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        affaire.type === AffaireType.FACULTATIVE
                          ? 'bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4)/0.3)]'
                          : 'bg-[hsl(var(--chart-5)/0.15)] text-[hsl(var(--chart-5))] border-[hsl(var(--chart-5)/0.3)]'
                      }`}>
                        {typeLabels[affaire.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-foreground">
                      {affaire.type === AffaireType.FACULTATIVE
                        ? affaire.facultativeData?.assure?.raisonSociale || '-'
                        : affaire.traiteData?.referenceTraite || <span className="text-muted-foreground/70">Sans référence</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-foreground">{affaire.cedante?.raisonSociale || '-'}</td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-foreground">
                      {formatCurrency(primeAffichee(affaire), affaire.currency)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-success">
                      {formatCurrency(commissionTotal(affaire), affaire.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${statutColors[affaire.statut]}`}>
                        {statutLabels[affaire.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/affaires/${affaire.id}`)}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        title="Voir détails"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-[12px] text-muted-foreground">Page {page} / {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => updateFilter('page', String(Math.max(1, page - 1)))}
                  disabled={page <= 1}
                  className="rounded-xl border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Précédent
                </button>
                <button
                  onClick={() => updateFilter('page', String(Math.min(totalPages, page + 1)))}
                  disabled={page >= totalPages}
                  className="rounded-xl border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <AffaireCreateModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}