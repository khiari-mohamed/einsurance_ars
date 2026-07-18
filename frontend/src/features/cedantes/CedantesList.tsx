import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, X, Eye, Shield, Globe, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { cedantesApi } from '../../api/master-data.api';
import {
  Cedante,
  getCompteComptableError,
  getIdentifiantUniqueError,
} from '../../types/cedante.types';

type Statut = 'ACTIVE' | 'INACTIVE' | 'ALL';
const LIMIT = 20;

export default function CedantesList() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState<Statut>('ACTIVE');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCedante, setEditingCedante] = useState<Cedante | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // FIX: debounce the search box so we don't fire a request on every keystroke.
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

  // FIX: was cedantesApi.getAll() with NO params — silently capped at the backend
  // default (page 1, limit 20) with no pagination UI to reach anything past that,
  // and `search` was never sent to the backend at all (only filtered client-side on
  // whatever 20 rows happened to load). Now sends search/page/limit/statut for real,
  // and keeps the previous page's data visible while the next page loads.
  const { data, isLoading, error } = useQuery({
    queryKey: ['cedantes', search, statut, page],
    queryFn: async () => {
      const { data } = await cedantesApi.getAll({
        search: search || undefined,
        page,
        limit: LIMIT,
        statut,
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const cedantes = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => cedantesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes'] });
    },
  });

  const handleEdit = (cedante: Cedante) => {
    setEditingCedante(cedante);
    setIsModalOpen(true);
  };

  // FIX: "supprimer" was misleading — this is a soft deactivation (isActive: false,
  // guarded by active-affaire checks server-side), not a permanent delete. Copy now
  // matches actual behavior.
  const handleDeactivate = (id: string) => {
    if (window.confirm('Désactiver cette compagnie d\'assurances ? Elle restera visible dans l\'historique mais ne sera plus sélectionnable pour de nouvelles affaires.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCedante(null);
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-[24px] font-semibold text-gray-900">Compagnies d'assurances</h1>
          <p className="text-[13px] text-gray-500 mt-1">Anciennement: Cédantes</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-[13px] font-medium"
        >
          <Plus size={18} />
          Nouvelle compagnie
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par raison sociale, code, compte comptable, identifiant unique ou pays..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* FIX (new): statut filter was implemented on the backend but unreachable
              from any UI — deactivated cédantes had no way to be viewed at all. */}
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

        {/* FIX (new): errors were only console.error'd — a failed request looked
            identical to "zero records" in the UI. */}
        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-2" size={24} />
            <p className="text-[13px] text-red-600">Erreur lors du chargement des compagnies. Veuillez réessayer.</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : cedantes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucune compagnie trouvée</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Raison Sociale</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Compte</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Identifiant Unique</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Résident</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Pays</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cedantes.map((cedante: Cedante) => (
                    <tr key={cedante.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{cedante.code}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-900">{cedante.raisonSociale}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 font-mono">{cedante.compteComptable || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 font-mono">{cedante.identifiantUnique || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">
                        {cedante.resident ? (
                          <span className="flex items-center gap-1 text-green-700">
                            <Shield size={14} />
                            Oui
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Globe size={14} />
                            Non
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">{cedante.pays || '-'}</td>
                      <td className="px-4 py-3 text-[13px]">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          cedante.isActive === false ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
                        }`}>
                          {cedante.isActive === false ? 'Inactif' : 'Actif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/cedantes/${cedante.id}`)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(cedante)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          {cedante.isActive !== false && (
                            <button
                              onClick={() => handleDeactivate(cedante.id)}
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
              {cedantes.map((cedante: Cedante) => (
                <div key={cedante.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Code</p>
                      <p className="text-[14px] font-semibold text-gray-900">{cedante.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/cedantes/${cedante.id}`)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleEdit(cedante)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      {cedante.isActive !== false && (
                        <button onClick={() => handleDeactivate(cedante.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase font-medium">Raison Sociale</p>
                      <p className="text-[13px] text-gray-900">{cedante.raisonSociale}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium">Compte</p>
                        <p className="text-[13px] text-gray-600 font-mono">{cedante.compteComptable || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium">Identifiant Unique</p>
                        <p className="text-[13px] text-gray-600 font-mono">{cedante.identifiantUnique || '-'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium">Résident</p>
                        <p className="text-[13px] text-gray-600">{cedante.resident ? 'Oui (Tunisien)' : 'Non (Étranger)'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium">Pays</p>
                        <p className="text-[13px] text-gray-600">{cedante.pays || '-'}</p>
                      </div>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      cedante.isActive === false ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
                    }`}>
                      {cedante.isActive === false ? 'Inactif' : 'Actif'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* FIX (new): real pagination controls — previously nonexistent, so
                anything past row 20 was unreachable. */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-[12px] text-gray-500">
                {total} compagnie{total !== 1 ? 's' : ''} — page {page} / {totalPages}
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
        <CedanteModal cedante={editingCedante} onClose={handleCloseModal} />
      )}
    </div>
  );
}

interface CedanteModalProps {
  cedante: Cedante | null;
  onClose: () => void;
}

function CedanteModal({ cedante, onClose }: CedanteModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<Cedante>>(
    cedante || {
      raisonSociale: '',
      compteComptable: '',
      identifiantUnique: '',
      resident: true,
      formeJuridique: '',
      adresse: '',
      pays: 'Tunisie',
      capital: undefined,
      rne: '',
    }
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (data: Partial<Cedante>) => {
      if (cedante) {
        return cedantesApi.update(cedante.id, data);
      }
      return cedantesApi.create(data as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cedantes'] });
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

    // FIX: now uses the shared, already-corrected validators from cedante.types.ts
    // instead of a hardcoded inline regex — this was the exact broken /^401200.../
    // pattern reappearing a third time because validation logic kept getting
    // reimplemented locally instead of imported from one source of truth.
    const identifiantError = getIdentifiantUniqueError(formData.identifiantUnique, formData.resident);
    if (identifiantError) {
      setErrors({ identifiantUnique: identifiantError });
      return;
    }

    const compteError = getCompteComptableError(formData.compteComptable);
    if (compteError) {
      setErrors({ compteComptable: compteError });
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
      // FIX: was `value.toUpperCase()` applied to EVERY field — typing "Star
      // Assurances" into Raison Sociale silently became "STAR ASSURANCES" on every
      // keystroke. Now targeted only at identifiantUnique, where uppercase is
      // actually the correct format (7 digits + 1 uppercase letter).
      const nextValue = name === 'identifiantUnique' ? value.toUpperCase() : value;
      setFormData((prev) => ({ ...prev, [name]: nextValue }));
    }
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const isEdit = !!cedante;
  const isAccountLocked = cedante?.isAccountLocked || false;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">
            {cedante ? 'Modifier la compagnie' : 'Nouvelle compagnie d\'assurances'}
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

          {/* NOTE: this modal (Onglet 1 — Informations Générales) is intentionally
              the only tab implemented here. Onglets 2-5 (Contacts, Conventions/GED,
              Coordonnées Bancaires, Champs Libres) aren't collected at creation time
              — no bank-account fields exist in this create/edit flow at all. If that's
              not the intended flow, flag it and I'll help build the missing tabs. */}

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
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Compte Comptable <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="compteComptable"
                value={formData.compteComptable || ''}
                onChange={handleChange}
                required
                disabled={isEdit && isAccountLocked}
                placeholder="4012xxxx"
                className={`w-full px-3 py-2 border ${errors.compteComptable ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isEdit && isAccountLocked ? 'bg-gray-100 text-gray-500' : ''}`}
              />
              {errors.compteComptable && <p className="mt-1 text-[11px] text-red-500">{errors.compteComptable}</p>}
              {isEdit && isAccountLocked && <p className="mt-1 text-[11px] text-gray-400">Verrouillé après création</p>}
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

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Résident Tunisien</label>
              <div className="flex items-center gap-4 mt-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="resident"
                    checked={formData.resident === true}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-[13px] text-gray-700">Oui</span>
                </label>
                {formData.resident && <span className="text-[11px] text-gray-400">(Identifiant Unique requis)</span>}
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Identifiant Unique
                {formData.resident && <span className="text-red-500 ml-1">*</span>}
              </label>
              <input
                type="text"
                name="identifiantUnique"
                value={formData.identifiantUnique || ''}
                onChange={handleChange}
                placeholder="1234567A"
                className={`w-full px-3 py-2 border ${errors.identifiantUnique ? 'border-red-500' : 'border-gray-200'} rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
              />
              {errors.identifiantUnique && <p className="mt-1 text-[11px] text-red-500">{errors.identifiantUnique}</p>}
              {formData.resident && !errors.identifiantUnique && (
                <p className="mt-1 text-[11px] text-gray-400">7 chiffres + 1 lettre (ex: 1234567A)</p>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">RNE (legacy)</label>
              <input
                type="text"
                name="rne"
                value={formData.rne || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-1 text-[11px] text-gray-400">Ancien format — remplacé par Identifiant Unique</p>
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