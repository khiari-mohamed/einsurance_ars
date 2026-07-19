import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Edit2, Trash2, X, Eye, ChevronLeft, ChevronRight, AlertCircle,
  Upload, Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { assuresApi } from '../../api/master-data.api';
import { Assure } from '../../types/assure.types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

type Statut = 'ACTIVE' | 'INACTIVE' | 'ALL';
const LIMIT = 20;

export default function AssuresList() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState<Statut>('ACTIVE');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssure, setEditingAssure] = useState<Assure | null>(null);
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

  // Clear selection whenever the visible page/filters change so we never act
  // on rows the user can no longer see.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, statut, page]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['assures', search, statut, page],
    queryFn: async () => {
      const { data } = await assuresApi.getAll({
        search: search || undefined,
        page,
        limit: LIMIT,
        statut,
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const assures = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assuresApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assures'] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => assuresApi.bulkDelete(ids),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['assures'] });
      setSelectedIds(new Set());
      const { deactivated, failed, results } = res.data;
      if (failed > 0) {
        const failedList = results
          .filter((r: any) => !r.success)
          .map((r: any) => `- ${r.error}`)
          .join('\n');
        window.alert(`${deactivated} client(s) désactivé(s).\n${failed} échec(s) :\n${failedList}`);
      }
    },
  });

  const handleEdit = (assure: Assure) => {
    setEditingAssure(assure);
    setIsModalOpen(true);
  };

  const handleDeactivate = (id: string) => {
    setConfirmState({
      type: 'single',
      message: 'Désactiver ce client ? Il restera visible dans l\'historique mais ne sera plus sélectionnable pour de nouvelles affaires.',
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
      message: `Désactiver ${ids.length} client(s) sélectionné(s) ? Ils resteront visibles dans l'historique mais ne seront plus sélectionnables pour de nouvelles affaires.`,
      onConfirm: () => {
        bulkDeleteMutation.mutate(ids);
        setConfirmState({ type: null });
      },
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAssure(null);
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = assures.length > 0 && assures.every((a: Assure) => selectedIds.has(a.id));
  const someSelected = assures.some((a: Assure) => selectedIds.has(a.id));

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        assures.forEach((a: Assure) => next.delete(a.id));
      } else {
        assures.forEach((a: Assure) => next.add(a.id));
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
          <h1 className="text-[24px] font-semibold text-gray-900">Clients</h1>
          <p className="text-[13px] text-gray-500 mt-1">Anciennement: Assurés</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-[13px] font-medium"
          >
            <Upload size={18} />
            Importer Excel
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-[13px] font-medium"
          >
            <Plus size={18} />
            Nouveau client
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par raison sociale, code, RNE ou pays..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 self-start sm:self-auto">
            {(['ACTIVE', 'INACTIVE', 'ALL'] as Statut[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatut(s)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                  statut === s ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s === 'ACTIVE' ? 'Actifs' : s === 'INACTIVE' ? 'Inactifs' : 'Tous'}
              </button>
            ))}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 bg-blue-50 border-b border-blue-100">
            <p className="text-[13px] font-medium text-blue-900">
              {selectedIds.size} client{selectedIds.size !== 1 ? 's' : ''} sélectionné{selectedIds.size !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBulkEditModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-white border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Edit2 size={14} />
                Modifier en masse
              </button>
              <button
                onClick={handleBulkDeactivate}
                disabled={bulkDeleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} />
                {bulkDeleteMutation.isPending ? 'Désactivation...' : 'Désactiver la sélection'}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-[12px] font-medium text-blue-700 hover:text-blue-900 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-2" size={24} />
            <p className="text-[13px] text-red-600">Erreur lors du chargement des clients. Veuillez réessayer.</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : assures.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun client trouvé</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Raison Sociale</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">RNE</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Pays</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assures.map((assure: Assure) => (
                    <tr key={assure.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(assure.id) ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(assure.id)}
                          onChange={() => toggleSelectOne(assure.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{assure.code}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-900">{assure.raisonSociale}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 font-mono">{assure.rne || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">{assure.pays || '-'}</td>
                      <td className="px-4 py-3 text-[13px]">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          assure.isActive === false ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
                        }`}>
                          {assure.isActive === false ? 'Inactif' : 'Actif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/assures/${assure.id}`)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(assure)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          {assure.isActive !== false && (
                            <button
                              onClick={() => handleDeactivate(assure.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
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

            <div className="md:hidden divide-y divide-gray-100">
              {assures.map((assure: Assure) => (
                <div key={assure.id} className={`p-4 hover:bg-gray-50 transition-colors ${selectedIds.has(assure.id) ? 'bg-blue-50/50' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(assure.id)}
                        onChange={() => toggleSelectOne(assure.id)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Code</p>
                        <p className="text-[14px] font-semibold text-gray-900">{assure.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/assures/${assure.id}`)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleEdit(assure)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      {assure.isActive !== false && (
                        <button onClick={() => handleDeactivate(assure.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase font-medium">Raison Sociale</p>
                      <p className="text-[13px] text-gray-900">{assure.raisonSociale}</p>
                    </div>
                    {assure.rne && (
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium">RNE</p>
                        <p className="text-[13px] text-gray-600 font-mono">{assure.rne}</p>
                      </div>
                    )}
                    {assure.pays && (
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium">Pays</p>
                        <p className="text-[13px] text-gray-600">{assure.pays}</p>
                      </div>
                    )}
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      assure.isActive === false ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
                    }`}>
                      {assure.isActive === false ? 'Inactif' : 'Actif'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-[12px] text-gray-500">
                {total} client{total !== 1 ? 's' : ''} — page {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <AssureModal assure={editingAssure} onClose={handleCloseModal} />
      )}

      {isImportModalOpen && (
        <ImportModal onClose={() => setIsImportModalOpen(false)} />
      )}

      {isBulkEditModalOpen && (
        <BulkEditModal
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

interface AssureModalProps {
  assure: Assure | null;
  onClose: () => void;
}

function AssureModal({ assure, onClose }: AssureModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Assure>>(
    assure || {
      raisonSociale: '',
      rne: '',
      formeJuridique: '',
      adresse: '',
      pays: 'Tunisie',
      capital: undefined,
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (data: Partial<Assure>) => {
      if (assure) {
        return assuresApi.update(assure.id, data);
      }
      return assuresApi.create(data as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assures'] });
      onClose();
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
    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">
            {assure ? 'Modifier le client' : 'Nouveau client'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Raison Sociale <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="raisonSociale"
                value={formData.raisonSociale || ''}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">RNE</label>
              <input
                type="text"
                name="rne"
                value={formData.rne || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-[11px] text-gray-400">Ancien format — optionnel pour les clients</p>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Forme Juridique</label>
              <input
                type="text"
                name="formeJuridique"
                value={formData.formeJuridique || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Adresse</label>
              <input
                type="text"
                name="adresse"
                value={formData.adresse || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Pays</label>
              <input
                type="text"
                name="pays"
                value={formData.pays || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Capital (TND)</label>
              <input
                type="number"
                name="capital"
                value={formData.capital || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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

interface ParsedRow {
  rowNumber: number;
  raisonSociale: string;
  rne: string;
  formeJuridique: string;
  adresse: string;
  pays: string;
  capital: string;
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

// Accepts common French header variants and maps them to Assure fields.
const HEADER_ALIASES: Record<string, string> = {
  raisonsociale: 'raisonSociale',
  raisonsocial: 'raisonSociale',
  nom: 'raisonSociale',
  rne: 'rne',
  formejuridique: 'formeJuridique',
  forme: 'formeJuridique',
  adresse: 'adresse',
  pays: 'pays',
  capital: 'capital',
  capitaltnd: 'capital',
};

interface ImportModalProps {
  onClose: () => void;
}

function ImportModal({ onClose }: ImportModalProps) {
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parseError, setParseError] = useState('');
  const [result, setResult] = useState<{ total: number; created: number; failed: number; results: any[] } | null>(null);

  const importMutation = useMutation({
    mutationFn: (items: any[]) => assuresApi.bulkImport(items),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['assures'] });
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

      const parsed: ParsedRow[] = rawRows.map((raw, idx) => {
        const mapped: Record<string, string> = {};
        Object.entries(raw).forEach(([key, value]) => {
          const field = HEADER_ALIASES[normalizeKey(key)];
          if (field) {
            mapped[field] = String(value ?? '').trim();
          }
        });

        const raisonSociale = mapped.raisonSociale || '';
        const isValid = raisonSociale.length > 0;

        return {
          rowNumber: idx + 2, // header row + 1-indexed
          raisonSociale,
          rne: mapped.rne || '',
          formeJuridique: mapped.formeJuridique || '',
          adresse: mapped.adresse || '',
          pays: mapped.pays || '',
          capital: mapped.capital || '',
          isValid,
          errorMsg: isValid ? undefined : 'Raison sociale manquante',
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
      { 'Raison Sociale': 'STE EXEMPLE SARL', RNE: '', 'Forme Juridique': 'SARL', Adresse: '', Pays: 'Tunisie', Capital: '' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, 'modele_import_clients.xlsx');
  };

  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);

  const handleConfirmImport = () => {
    const items = validRows.map((r) => ({
      raisonSociale: r.raisonSociale,
      rne: r.rne || undefined,
      formeJuridique: r.formeJuridique || undefined,
      adresse: r.adresse || undefined,
      pays: r.pays || undefined,
      capital: r.capital ? Number(r.capital) : undefined,
    }));
    importMutation.mutate(items);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">Importer des clients (Excel)</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {parseError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
              {parseError}
            </div>
          )}

          {step === 'upload' && (
            <div>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
                <Upload className="mx-auto text-gray-400 mb-3" size={32} />
                <p className="text-[13px] text-gray-600 mb-1">Sélectionnez un fichier Excel ou CSV</p>
                <p className="text-[11px] text-gray-400 mb-4">
                  Colonnes attendues : Raison Sociale (obligatoire), RNE, Forme Juridique, Adresse, Pays, Capital
                </p>
                <label className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer hover:bg-blue-700 transition-colors">
                  <Upload size={16} />
                  Choisir un fichier
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
                </label>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="mt-4 flex items-center gap-2 text-[12px] text-blue-600 hover:text-blue-700 font-medium"
              >
                <Download size={14} />
                Télécharger un modèle vide
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] text-gray-600">
                  <span className="font-medium text-gray-900">{fileName}</span> — {rows.length} ligne(s) détectée(s)
                </p>
                <button onClick={() => setStep('upload')} className="text-[12px] text-blue-600 hover:text-blue-700 font-medium">
                  Changer de fichier
                </button>
              </div>

              <div className="flex gap-3 mb-3">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-green-50 text-green-700">
                  {validRows.length} valide(s)
                </span>
                {invalidRows.length > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-700">
                    {invalidRows.length} invalide(s)
                  </span>
                )}
              </div>

              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Ligne</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Raison Sociale</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">RNE</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Pays</th>
                        <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr key={r.rowNumber} className={r.isValid ? '' : 'bg-red-50/50'}>
                          <td className="px-3 py-2 text-[12px] text-gray-500">{r.rowNumber}</td>
                          <td className="px-3 py-2 text-[12px] text-gray-900">{r.raisonSociale || '-'}</td>
                          <td className="px-3 py-2 text-[12px] text-gray-600 font-mono">{r.rne || '-'}</td>
                          <td className="px-3 py-2 text-[12px] text-gray-600">{r.pays || '-'}</td>
                          <td className="px-3 py-2 text-[12px]">
                            {r.isValid ? (
                              <span className="text-green-700">OK</span>
                            ) : (
                              <span className="text-red-600">{r.errorMsg}</span>
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
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-green-50 text-green-700">
                  {result.created} créé(s)
                </span>
                {result.failed > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-700">
                    {result.failed} échec(s)
                  </span>
                )}
              </div>
              {result.failed > 0 && (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {result.results
                      .filter((r: any) => !r.success)
                      .map((r: any, idx: number) => (
                        <div key={idx} className="px-3 py-2 text-[12px]">
                          <span className="font-medium text-gray-900">{r.raisonSociale || `Ligne ${r.row}`}</span>
                          <span className="text-red-600"> — {r.error}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
          {step === 'result' ? (
            <button onClick={onClose} className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Fermer
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                Annuler
              </button>
              {step === 'preview' && (
                <button
                  onClick={handleConfirmImport}
                  disabled={validRows.length === 0 || importMutation.isPending}
                  className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {importMutation.isPending ? 'Import en cours...' : `Importer ${validRows.length} client(s)`}
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

function BulkEditModal({ ids, onClose, onDone }: BulkEditModalProps) {
  const [pays, setPays] = useState('');
  const [formeJuridique, setFormeJuridique] = useState('');
  const [applyPays, setApplyPays] = useState(false);
  const [applyForme, setApplyForme] = useState(false);
  const [statutAction, setStatutAction] = useState<'NONE' | 'ACTIVATE' | 'DEACTIVATE'>('NONE');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => assuresApi.bulkUpdate(ids, data),
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
    if (statutAction === 'ACTIVATE') data.isActive = true;
    if (statutAction === 'DEACTIVATE') data.isActive = false;

    if (Object.keys(data).length === 0) {
      setError('Sélectionnez au moins un champ à modifier.');
      return;
    }
    mutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-[18px] font-semibold text-gray-900">Modification en masse</h2>
            <p className="text-[12px] text-gray-500 mt-0.5">{ids.length} client(s) sélectionné(s)</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
              {error}
            </div>
          )}

          <p className="text-[12px] text-gray-500 mb-4">
            Cochez les champs à modifier. Les champs non cochés resteront inchangés.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={applyPays}
                onChange={(e) => setApplyPays(e.target.checked)}
                className="mt-2.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Pays</label>
                <input
                  type="text"
                  value={pays}
                  onChange={(e) => setPays(e.target.value)}
                  disabled={!applyPays}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={applyForme}
                onChange={(e) => setApplyForme(e.target.checked)}
                className="mt-2.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Forme Juridique</label>
                <input
                  type="text"
                  value={formeJuridique}
                  onChange={(e) => setFormeJuridique(e.target.value)}
                  disabled={!applyForme}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Statut</label>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
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
                      statutAction === opt.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Application...' : `Appliquer à ${ids.length} client(s)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}