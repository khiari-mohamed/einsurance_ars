import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, AlertCircle, CheckCircle, Clock, XCircle, ShieldCheck, Undo2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sinistresApi } from '../../api/sinistres.api';
import type { Sinistre, SinistreStatut } from '../../types/sinistre.types';
import { STATUT_LABELS, STATUT_COLORS } from '../../types/sinistre.types';
import { formatCurrency } from '../../lib/currency';

const STATUT_ICONS: Record<SinistreStatut, any> = {
  DECLARE: AlertCircle,
  EN_COURS_VALIDATION: Clock,
  VALIDE: CheckCircle,
  REJETE: XCircle,
  DECLARE_REASSUREURS: ShieldCheck,
  EN_RECUPERATION: Clock,
  RECUPERE: Undo2,
  CLOS: CheckCircle,
};

export default function SinistresList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<{ statut?: SinistreStatut; cedanteId?: string }>({});

  const { data, isLoading } = useQuery({
    queryKey: ['sinistres', filters],
    queryFn: () => sinistresApi.getAll({ ...filters, limit: 50 }),
  });

  const { data: kpis } = useQuery({
    queryKey: ['sinistres-kpis'],
    queryFn: () => sinistresApi.getKpis(),
  });

  const sinistres = data?.data?.data ?? [];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-3xl font-semibold text-foreground">Sinistres</h1>
        <button
          onClick={() => navigate('/sinistres/new')}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90"
        >
          <Plus size={20} />
          Nouveau Sinistre
        </button>
      </div>

      {kpis?.data && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-card p-4 rounded-[var(--radius)] border border-border">
            <div className="text-sm text-muted-foreground">Total Sinistres ({kpis.data.year})</div>
            <div className="text-2xl font-bold">{kpis.data.totalSinistres}</div>
          </div>
          <div className="bg-card p-4 rounded-[var(--radius)] border border-border">
            <div className="text-sm text-muted-foreground">Réserves Totales</div>
            <div className="text-2xl font-bold text-warning">{formatCurrency(kpis.data.reservesTotales)}</div>
          </div>
          <div className="bg-card p-4 rounded-[var(--radius)] border border-border">
            <div className="text-sm text-muted-foreground">Part Réassureurs</div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(kpis.data.partReassureursTotale)}</div>
          </div>
          <div className="bg-card p-4 rounded-[var(--radius)] border border-border">
            <div className="text-sm text-muted-foreground">SAP Total</div>
            <div className="text-2xl font-bold">{formatCurrency(kpis.data.sapTotal)}</div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-[var(--radius)] border border-border mb-4 p-4">
        <div className="flex gap-4">
          <select
            value={filters.statut || ''}
            onChange={(e) => setFilters({ ...filters, statut: (e.target.value || undefined) as SinistreStatut })}
            className="border border-border bg-background rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-card rounded-[var(--radius)] border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Sinistre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affaire</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cédante</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Survenance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Réserves</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part Réass.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sinistres.map((s: Sinistre) => {
                const StatusIcon = STATUT_ICONS[s.statut];
                return (
                  <tr key={s.id} className="hover:bg-muted/60">
                    <td className="px-6 py-4 text-sm font-medium text-primary">{s.numero}</td>
                    <td className="px-6 py-4 text-sm">{s.affaire?.numero}</td>
                    <td className="px-6 py-4 text-sm">{s.affaire?.cedante?.raisonSociale}</td>
                    <td className="px-6 py-4 text-sm">{new Date(s.dateSurvenance).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(s.reserves ?? 0)}</td>
                    <td className="px-6 py-4 text-sm">{formatCurrency(s.partReassureurs ?? 0)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[s.statut]}`}>
                        <StatusIcon size={14} />
                        {STATUT_LABELS[s.statut]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => navigate(`/sinistres/${s.id}`)} className="text-primary hover:text-primary/80">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sinistres.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">Aucun sinistre trouvé</div>
          )}
        </div>
      )}
    </div>
  );
}