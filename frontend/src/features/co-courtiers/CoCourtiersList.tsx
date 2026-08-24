import { useState } from 'react';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit2, Trash2, X, Eye, Shield, Globe, ChevronLeft, ChevronRight, AlertCircle,
  Upload, Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { coCourtiersApi } from '../../api/master-data.api';
import {
  CoCourtier,
  getCoCourtierCompteComptableError,
  getCoCourtierIdentifiantUniqueError,
} from '../../types/co-courtier.types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

type Statut = 'ACTIVE' | 'INACTIVE' | 'ALL';
const LIMIT = 20;
const CURRENCIES = ['TND', 'EUR', 'USD', 'GBP', 'JPY'];

export default function CoCourtiersList() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState<Statut>('ACTIVE');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoCourtier, setEditingCoCourtier] = useState<CoCourtier | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<{ type: 'single' | 'bulk' | null; onConfirm?: () => void; message?: string }>({ type: null });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statut]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, statut, page]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['co-courtiers', search, statut, page],
    queryFn: async () => {
      const { data } = await coCourtiersApi.getAll({
        search: search || undefined,
        page,
        limit: LIMIT,
        statut,
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const coCourtiers = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => coCourtiersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['co-courtiers'] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => coCourtiersApi.bulkDelete(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['co-courtiers'] });
      setSelectedIds(new Set());
      const { deactivated, failed, results } = res.data;
      if (failed > 0) {
        const failedList = results
          .filter((r: any) => !r.success)
          .map((r: any) => `- ${r.error}`)
          .join('\n');
        window.alert(`${deactivated} courtier(s) désactivé(s).\n${failed} échec(s) :\n${failedList}`);
      }
    },
  });

  const handleEdit = (coCourtier: CoCourtier) => {
    setEditingCoCourtier(coCourtier);
    setIsModalOpen(true);
  };

  const handleDeactivate = (id: string) => {
    setConfirmState({
      type: 'single',
      message: 'Désactiver ce courtier en réassurance ? Il restera visible dans l\'historique mais ne sera plus sélectionnable pour de nouvelles affaires.',
      onConfirm: () => {
        deleteMutation.mutate(id);
        setConfirmState({ type: null });
      },
    });
  };

  const handleBulkDeactivate = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setConfirmState({
      type: 'bulk',
      message: `Désactiver ${ids.length} courtier(s) sélectionné(s) ? Ils resteront visibles dans l'historique mais ne seront plus sélectionnables pour de nouvelles affaires.`,
      onConfirm: () => {
        bulkDeleteMutation.mutate(ids);
        setConfirmState({ type: null });
      },
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCoCourtier(null);
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = coCourtiers.length > 0 && coCourtiers.every((c: CoCourtier) => selectedIds.has(c.id));
  const someSelected = coCourtiers.some((c: CoCourtier) => selectedIds.has(c.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        coCourtiers.forEach((c: CoCourtier) => next.delete(c.id));
      } else {
        coCourtiers.forEach((c: CoCourtier) => next.add(c.id));
      }
      return next;
    });
  };

  return (
    <div className="p-4 lg:p-6">
      <ConfirmDialog
        open={confirmState.type !== null}
        title="Désactivation"
        message={confirmState.message || ''}
        confirmLabel="Confirmer"
        confirmVariant="danger"
        onConfirm={() => confirmState.onConfirm?.()}
        onCancel={() => setConfirmState({ type: null })}
      />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Courtiers en réassurance</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Anciennement: Co-Courtiers</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-card border border-border text-secondary-foreground px-4 py-2.5 rounded-xl hover:bg-secondary/60 transition-colors text-[13px] font-medium"
          >
            <Upload size={18} />
            Importer Excel
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors text-[13px] font-medium"
          >
            <Plus size={18} />
            Nouveau courtier
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Rechercher par raison sociale, code, compte comptable, identifiant unique ou pays..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-border bg-secondary rounded-xl text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition"
            />
          </div>
          <div className="flex gap-1 bg-secondary rounded-lg p-1 self-start sm:self-auto">
            {(['ACTIVE', 'INACTIVE', 'ALL'] as Statut[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatut(s)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                  statut === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'ACTIVE' ? 'Actifs' : s === 'INACTIVE' ? 'Inactifs' : 'Tous'}
              </button>
            ))}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 bg-primary/10 border-b border-primary/20">
            <p className="text-[13px] font-medium text-primary">
              {selectedIds.size} courtier{selectedIds.size !== 1 ? 's' : ''} sélectionné{selectedIds.size !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBulkEditModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-card border border-primary/25 text-primary rounded-lg hover:bg-primary/15 transition-colors"
              >
                <Edit2 size={14} />
                Modifier en masse
              </button>
              <button
                onClick={handleBulkDeactivate}
                disabled={bulkDeleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-card border border-destructive/25 text-destructive rounded-lg hover:bg-destructive/15 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                {bulkDeleteMutation.isPending ? 'Désactivation...' : 'Désactiver la sélection'}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="mx-auto text-destructive mb-2" size={24} />
            <p className="text-[13px] text-destructive">Erreur lors du chargement des courtiers. Veuillez réessayer.</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Chargement...</div>
        ) : coCourtiers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Aucun courtier trouvé</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-secondary/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Raison Sociale</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Compte</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Identifiant Unique</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Résident</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pays</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {coCourtiers.map((c: CoCourtier) => (
                    <tr key={c.id} className={`hover:bg-secondary/40 transition-colors ${selectedIds.has(c.id) ? 'bg-primary/5' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelectOne(c.id)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium text-foreground">{c.code}</td>
                      <td className="px-4 py-3 text-[13px] text-foreground">{c.raisonSociale}</td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground font-mono">{c.compteComptable || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground font-mono">{c.identifiantUnique || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground">
                        {c.resident ? (
                          <span className="flex items-center gap-1 text-success">
                            <Shield size={14} />
                            Oui
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[hsl(var(--chart-4))]">
                            <Globe size={14} />
                            Non
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground">{c.pays || '-'}</td>
                      <td className="px-4 py-3 text-[13px]">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                          c.isActive === false ? 'bg-muted text-muted-foreground border-border' : 'bg-success/15 text-success border-success/25'
                        }`}>
                          {c.isActive === false ? 'Inactif' : 'Actif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/co-courtiers/${c.id}`)}
                            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(c)}
                            className="p-1.5 rounded-lg hover:bg-primary/15 text-primary transition-colors"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          {c.isActive !== false && (
                            <button
                              onClick={() => handleDeactivate(c.id)}
                              className="p-1.5 rounded-lg hover:bg-destructive/15 text-destructive transition-colors"
                              title="Désactiver"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-border/50">
              {coCourtiers.map((c: CoCourtier) => (
                <div key={c.id} className={`p-4 hover:bg-secondary/40 transition-colors ${selectedIds.has(c.id) ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelectOne(c.id)}
                        className="mt-1 rounded border-border text-primary focus:ring-primary"
                      />
                      <div className="flex-1">
                        <p className="text-[11px] text-muted-foreground uppercase font-medium mb-1">Code</p>
                        <p className="text-[14px] font-semibold text-foreground">{c.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/co-courtiers/${c.id}`)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleEdit(c)} className="p-2 rounded-lg hover:bg-primary/15 text-primary transition-colors">
                        <Edit2 size={18} />
                      </button>
                      {c.isActive !== false && (
                        <button onClick={() => handleDeactivate(c.id)} className="p-2 rounded-lg hover:bg-destructive/15 text-destructive transition-colors">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase font-medium">Raison Sociale</p>
                      <p className="text-[13px] text-foreground">{c.raisonSociale}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">Compte Comptable</p>
                        <p className="text-[13px] text-muted-foreground font-mono">{c.compteComptable || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">Identifiant Unique</p>
                        <p className="text-[13px] text-muted-foreground font-mono">{c.identifiantUnique || '-'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">Résident</p>
                        <p className="text-[13px] text-muted-foreground">{c.resident ? 'Oui (Tunisien)' : 'Non (Étranger)'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase font-medium">Pays</p>
                        <p className="text-[13px] text-muted-foreground">{c.pays || '-'}</p>
                      </div>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                      c.isActive === false ? 'bg-muted text-muted-foreground border-border' : 'bg-success/15 text-success border-success/25'
                    }`}>
                      {c.isActive === false ? 'Inactif' : 'Actif'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-[12px] text-muted-foreground">
                {total} courtier{total !== 1 ? 's' : ''} — page {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/60"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/60"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <CoCourtierModal coCourtier={editingCoCourtier} onClose={handleCloseModal} />
      )}

      {isImportModalOpen && (
        <CoCourtierImportModal onClose={() => setIsImportModalOpen(false)} />
      )}

      {isBulkEditModalOpen && (
        <CoCourtierBulkEditModal
          ids={Array.from(selectedIds)}
          onClose={() => setIsBulkEditModalOpen(false)}
          onDone={() => {
            setIsBulkEditModalOpen(false);
            setSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}

interface CoCourtierModalProps {
  coCourtier: CoCourtier | null;
  onClose: () => void;
}

function CoCourtierModal({ coCourtier, onClose }: CoCourtierModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Partial<CoCourtier>>(
    coCourtier || {
      raisonSociale: '',
      compteComptable: '',
      identifiantUnique: '',
      // FIX (Co-Courtier pass): defaulted to true previously, which doesn't
      // match the actual data — the documented co-courtiers (AON LIMITED,
      // MNK RE LIMITED, CKRE) are all foreign brokerage entities. Flipped to
      // false; this is purely a form default, not a business rule (CDC
      // §5.6.4 leaves "tunisien vs international" explicitly open).
      resident: false,
      rne: '',
      formeJuridique: '',
      adresse: '',
      pays: 'Tunisie',
      capital: undefined,
      // FIX (new): was entirely absent from the form even though the schema
      // has always had it.
      deviseParDefaut: 'TND',
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (data: Partial<CoCourtier>) => {
      if (coCourtier) {
        return coCourtiersApi.update(coCourtier.id, data);
      }
      return coCourtiersApi.create(data as any);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['co-courtiers'] });
      onClose();
      // FIX (new): the fiche needs Contacts / Coordonnées Bancaires /
      // Conventions filled in next (Onglets 2-4, CDC §5.7) — those only
      // exist on the Detail page. Route straight there right after create
      // so the record doesn't sit half-empty.
      const newId = (res as any)?.data?.id;
      if (!coCourtier && newId) {
        navigate(`/co-courtiers/${newId}`);
      }
    },
    onError: (error: any) => {
      if (error.response?.data?.message) {
        setErrors({ submit: error.response.data.message });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const compteError = getCoCourtierCompteComptableError(formData.compteComptable);
    if (compteError) {
      setErrors({ compteComptable: compteError });
      return;
    }

    const identifiantError = getCoCourtierIdentifiantUniqueError(formData.identifiantUnique, formData.resident);
    if (identifiantError) {
      setErrors({ identifiantUnique: identifiantError });
      return;
    }

    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      const nextValue = name === 'identifiantUnique' ? value.toUpperCase() : value;
      setFormData((prev) => ({ ...prev, [name]: nextValue }));
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const isEdit = !!coCourtier;
  const isAccountLocked = coCourtier?.isAccountLocked || false;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {coCourtier ? 'Modifier le courtier' : 'Nouveau courtier en réassurance'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errors.submit && (
            <div className="mb-4 p-3 bg-destructive/15 border border-destructive/25 rounded-lg text-[13px] text-destructive">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                Raison Sociale <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="raisonSociale"
                value={formData.raisonSociale || ''}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-border bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                Compte Comptable <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="compteComptable"
                value={formData.compteComptable || ''}
                onChange={handleChange}
                required
                disabled={isEdit && isAccountLocked}
                placeholder="401xxxxx"
                className={`w-full px-3 py-2 border ${errors.compteComptable ? 'border-destructive' : 'border-border'} bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition ${isEdit && isAccountLocked ? 'opacity-60 text-muted-foreground' : ''}`}
              />
              {errors.compteComptable && <p className="mt-1 text-[11px] text-destructive">{errors.compteComptable}</p>}
              {isEdit && isAccountLocked && <p className="mt-1 text-[11px] text-muted-foreground/70">Verrouillé après création</p>}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Forme Juridique</label>
              <input
                type="text"
                name="formeJuridique"
                value={formData.formeJuridique || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Résident Tunisien</label>
              <div className="flex items-center gap-4 mt-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="resident"
                    checked={formData.resident === true}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                  />
                  <span className="text-[13px] text-foreground">Oui</span>
                </label>
                {formData.resident && <span className="text-[11px] text-muted-foreground/70">(Identifiant Unique requis)</span>}
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
                Identifiant Unique
                {formData.resident && <span className="text-destructive ml-1">*</span>}
              </label>
              <input
                type="text"
                name="identifiantUnique"
                value={formData.identifiantUnique || ''}
                onChange={handleChange}
                placeholder="1234567A"
                className={`w-full px-3 py-2 border ${errors.identifiantUnique ? 'border-destructive' : 'border-border'} bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition`}
              />
              {errors.identifiantUnique && <p className="mt-1 text-[11px] text-destructive">{errors.identifiantUnique}</p>}
              {formData.resident && !errors.identifiantUnique && (
                <p className="mt-1 text-[11px] text-muted-foreground/70">7 chiffres + 1 lettre (ex: 1234567A)</p>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">RNE</label>
              <input
                type="text"
                name="rne"
                value={formData.rne || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition"
              />
            </div>

            <div>
              {/* FIX (new): devise par défaut field — was entirely missing. */}
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Devise par défaut</label>
              <select
                name="deviseParDefaut"
                value={formData.deviseParDefaut || 'TND'}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Adresse</label>
              <input
                type="text"
                name="adresse"
                value={formData.adresse || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Pays</label>
              <input
                type="text"
                name="pays"
                value={formData.pays || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Capital (TND)</label>
              <input
                type="number"
                name="capital"
                value={formData.capital || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition"
              />
            </div>
          </div>

          {!isEdit && (
            <p className="mt-4 text-[11px] text-muted-foreground/70">
              Les contacts, coordonnées bancaires et conventions (GED) se gèrent depuis la fiche
              détaillée, juste après la création.
            </p>
          )}

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// BULK IMPORT (Excel/CSV)
// ============================================================

interface ParsedCoCourtierRow {
  rowNumber: number;
  raisonSociale: string;
  compteComptable: string;
  identifiantUnique: string;
  resident: string;
  rne: string;
  formeJuridique: string;
  adresse: string;
  pays: string;
  capital: string;
  deviseParDefaut: string;
  isValid: boolean;
  errorMsg?: string;
}

function normalizeKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES: Record<string, string> = {
  raisonsociale: 'raisonSociale',
  raisonsocial: 'raisonSociale',
  nom: 'raisonSociale',
  comptecomptable: 'compteComptable',
  compte: 'compteComptable',
  identifiantunique: 'identifiantUnique',
  identifiant: 'identifiantUnique',
  resident: 'resident',
  rne: 'rne',
  formejuridique: 'formeJuridique',
  forme: 'formeJuridique',
  adresse: 'adresse',
  pays: 'pays',
  capital: 'capital',
  capitaltnd: 'capital',
  // FIX (new): devise column mapping — was previously unmapped.
  devise: 'deviseParDefaut',
  deviseparfaut: 'deviseParDefaut',
  deviseparfaut2: 'deviseParDefaut',
  monnaie: 'deviseParDefaut',
};

function parseResident(value: string): boolean | undefined {
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  if (['oui', 'yes', 'true', '1', 'x'].includes(v)) return true;
  if (['non', 'no', 'false', '0'].includes(v)) return false;
  return undefined;
}

interface ImportModalProps {
  onClose: () => void;
}

function CoCourtierImportModal({ onClose }: ImportModalProps) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedCoCourtierRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<{ total: number; created: number; failed: number; results: any[] } | null>(null);

  const importMutation = useMutation({
    mutationFn: (items: any[]) => coCourtiersApi.bulkImport(items),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['co-courtiers'] });
      setResult(res.data);
      setStep('result');
    },
    onError: (err: any) => {
      setParseError(err.response?.data?.message || "Erreur lors de l'import.");
    },
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rawRows.length === 0) {
        setParseError('Le fichier ne contient aucune ligne de données.');
        return;
      }

      const parsed: ParsedCoCourtierRow[] = rawRows.map((raw, idx) => {
        const mapped: Record<string, string> = {};
        Object.entries(raw).forEach(([key, value]) => {
          const field = HEADER_ALIASES[normalizeKey(key)];
          if (field) {
            mapped[field] = String(value ?? '').trim();
          }
        });

        const raisonSociale = mapped.raisonSociale || '';
        const compteComptable = mapped.compteComptable || '';
        const isValid = raisonSociale.length > 0 && compteComptable.length > 0;
        let errorMsg: string | undefined;
        if (!raisonSociale) errorMsg = 'Raison sociale manquante';
        else if (!compteComptable) errorMsg = 'Compte comptable manquant';

        return {
          rowNumber: idx + 2,
          raisonSociale,
          compteComptable,
          identifiantUnique: mapped.identifiantUnique || '',
          resident: mapped.resident || '',
          rne: mapped.rne || '',
          formeJuridique: mapped.formeJuridique || '',
          adresse: mapped.adresse || '',
          pays: mapped.pays || '',
          capital: mapped.capital || '',
          deviseParDefaut: mapped.deviseParDefaut || '',
          isValid,
          errorMsg,
        };
      });

      setRows(parsed);
      setStep('preview');
    } catch {
      setParseError('Impossible de lire ce fichier. Formats acceptés : .xlsx, .xls, .csv');
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        'Raison Sociale': 'STE COURTIER EXEMPLE',
        'Compte Comptable': '40130001',
        'Identifiant Unique': '',
        'Résident': 'Non',
        RNE: '',
        'Forme Juridique': '',
        Adresse: '',
        Pays: '',
        Capital: '',
        Devise: 'TND',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Co-courtiers');
    XLSX.writeFile(wb, 'modele_import_co_courtiers.xlsx');
  };

  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);

  const handleConfirmImport = () => {
    const items = validRows.map((r) => ({
      raisonSociale: r.raisonSociale,
      compteComptable: r.compteComptable,
      identifiantUnique: r.identifiantUnique || undefined,
      resident: parseResident(r.resident),
      rne: r.rne || undefined,
      formeJuridique: r.formeJuridique || undefined,
      adresse: r.adresse || undefined,
      pays: r.pays || undefined,
      capital: r.capital ? Number(r.capital) : undefined,
      deviseParDefaut: r.deviseParDefaut || undefined,
    }));
    importMutation.mutate(items);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-display text-lg font-semibold text-foreground">Importer des courtiers (Excel)</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {parseError && (
            <div className="mb-4 p-3 bg-destructive/15 border border-destructive/25 rounded-lg text-[13px] text-destructive">
              {parseError}
            </div>
          )}

          {step === 'upload' && (
            <div>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
                <Upload className="mx-auto text-muted-foreground mb-3" size={32} />
                <p className="text-[13px] text-muted-foreground mb-1">Sélectionnez un fichier Excel ou CSV</p>
                <p className="text-[11px] text-muted-foreground/70 mb-4">
                  Colonnes attendues : Raison Sociale (obligatoire), Compte Comptable (obligatoire), Identifiant Unique, Résident, RNE, Forme Juridique, Adresse, Pays, Capital, Devise
                </p>
                <label className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                  <Upload size={16} />
                  Choisir un fichier
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
                </label>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="mt-4 flex items-center gap-2 text-[12px] text-primary hover:text-primary/80 font-medium"
              >
                <Download size={14} />
                Télécharger un modèle vide
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground">{fileName}</span> — {rows.length} ligne(s) détectée(s)
                </p>
                <button onClick={() => setStep('upload')} className="text-[12px] text-primary hover:text-primary/80 font-medium">
                  Changer de fichier
                </button>
              </div>

              <div className="flex gap-3 mb-3">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-success/15 text-success border border-success/25">
                  {validRows.length} valide(s)
                </span>
                {invalidRows.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-destructive/15 text-destructive border border-destructive/25">
                    {invalidRows.length} invalide(s)
                  </span>
                )}
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-secondary/40 border-b border-border sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase">Ligne</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase">Raison Sociale</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase">Compte</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase">Résident</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase">Devise</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground uppercase">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {rows.map((r) => (
                        <tr key={r.rowNumber} className={r.isValid ? '' : 'bg-destructive/5'}>
                          <td className="px-3 py-2 text-[12px] text-muted-foreground">{r.rowNumber}</td>
                          <td className="px-3 py-2 text-[12px] text-foreground">{r.raisonSociale || '-'}</td>
                          <td className="px-3 py-2 text-[12px] text-muted-foreground font-mono">{r.compteComptable || '-'}</td>
                          <td className="px-3 py-2 text-[12px] text-muted-foreground">{r.resident || '-'}</td>
                          <td className="px-3 py-2 text-[12px] text-muted-foreground">{r.deviseParDefaut || '-'}</td>
                          <td className="px-3 py-2 text-[12px]">
                            {r.isValid ? (
                              <span className="text-success">OK</span>
                            ) : (
                              <span className="text-destructive">{r.errorMsg}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-success/15 text-success border border-success/25">
                  {result.created} créé(s)
                </span>
                {result.failed > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-destructive/15 text-destructive border border-destructive/25">
                    {result.failed} échec(s)
                  </span>
                )}
              </div>
              {result.failed > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
                    {result.results
                      .filter((r: any) => !r.success)
                      .map((r: any, idx: number) => (
                        <div key={idx} className="px-3 py-2 text-[12px]">
                          <span className="font-medium text-foreground">{r.raisonSociale || `Ligne ${r.row}`}</span>
                          <span className="text-destructive"> — {r.error}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          {step === 'result' ? (
            <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              Fermer
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
                Annuler
              </button>
              {step === 'preview' && (
                <button
                  onClick={handleConfirmImport}
                  disabled={validRows.length === 0 || importMutation.isPending}
                  className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {importMutation.isPending ? 'Import en cours...' : `Importer ${validRows.length} courtier(s)`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BULK EDIT
// ============================================================

interface BulkEditModalProps {
  ids: string[];
  onClose: () => void;
  onDone: () => void;
}

function CoCourtierBulkEditModal({ ids, onClose, onDone }: BulkEditModalProps) {
  const [pays, setPays] = useState('');
  const [formeJuridique, setFormeJuridique] = useState('');
  const [deviseParDefaut, setDeviseParDefaut] = useState('TND');
  const [applyPays, setApplyPays] = useState(false);
  const [applyForme, setApplyForme] = useState(false);
  const [applyDevise, setApplyDevise] = useState(false);
  const [statutAction, setStatutAction] = useState<'NONE' | 'ACTIVATE' | 'DEACTIVATE'>('NONE');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => coCourtiersApi.bulkUpdate(ids, data),
    onSuccess: () => {
      onDone();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour en masse.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const data: any = {};
    if (applyPays) data.pays = pays;
    if (applyForme) data.formeJuridique = formeJuridique;
    if (applyDevise) data.deviseParDefaut = deviseParDefaut;
    if (statutAction === 'ACTIVATE') data.isActive = true;
    if (statutAction === 'DEACTIVATE') data.isActive = false;

    if (Object.keys(data).length === 0) {
      setError('Sélectionnez au moins un champ à modifier.');
      return;
    }
    mutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Modification en masse</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">{ids.length} courtier(s) sélectionné(s)</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-destructive/15 border border-destructive/25 rounded-lg text-[13px] text-destructive">
              {error}
            </div>
          )}

          <p className="text-[12px] text-muted-foreground mb-4">
            Cochez les champs à modifier. Les champs non cochés resteront inchangés.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={applyPays}
                onChange={(e) => setApplyPays(e.target.checked)}
                className="mt-2.5 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Pays</label>
                <input
                  type="text"
                  value={pays}
                  onChange={(e) => setPays(e.target.value)}
                  disabled={!applyPays}
                  className="w-full px-3 py-2 border border-border bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={applyForme}
                onChange={(e) => setApplyForme(e.target.checked)}
                className="mt-2.5 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Forme Juridique</label>
                <input
                  type="text"
                  value={formeJuridique}
                  onChange={(e) => setFormeJuridique(e.target.value)}
                  disabled={!applyForme}
                  className="w-full px-3 py-2 border border-border bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={applyDevise}
                onChange={(e) => setApplyDevise(e.target.checked)}
                className="mt-2.5 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Devise par défaut</label>
                <select
                  value={deviseParDefaut}
                  onChange={(e) => setDeviseParDefaut(e.target.value)}
                  disabled={!applyDevise}
                  className="w-full px-3 py-2 border border-border bg-secondary rounded-lg text-[13px] text-foreground outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background focus:border-primary transition disabled:opacity-50"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Statut</label>
              <div className="flex gap-1 bg-secondary rounded-lg p-1">
                {(
                  [
                    { key: 'NONE', label: 'Ne pas changer' },
                    { key: 'ACTIVATE', label: 'Activer' },
                    { key: 'DEACTIVATE', label: 'Désactiver' },
                  ] as { key: typeof statutAction; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setStatutAction(opt.key)}
                    className={`flex-1 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                      statutAction === opt.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary rounded-lg transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Application...' : `Appliquer à ${ids.length} courtier(s)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}