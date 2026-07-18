import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, X, Eye, Shield, Globe, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { coCourtiersApi } from '../../api/master-data.api';
import {
  CoCourtier,
  getCoCourtierCompteComptableError,
  getCoCourtierIdentifiantUniqueError,
} from '../../types/co-courtier.types';

type Statut = 'ACTIVE' | 'INACTIVE' | 'ALL';
const LIMIT = 20;

export default function CoCourtiersList() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState<Statut>('ACTIVE');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoCourtier, setEditingCoCourtier] = useState<CoCourtier | null>(null);
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

  const handleEdit = (coCourtier: CoCourtier) => {
    setEditingCoCourtier(coCourtier);
    setIsModalOpen(true);
  };

  const handleDeactivate = (id: string) => {
    if (window.confirm('Désactiver ce courtier en réassurance ? Il restera visible dans l\'historique mais ne sera plus sélectionnable pour de nouvelles affaires.')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCoCourtier(null);
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-[24px] font-semibold text-gray-900">Courtiers en réassurance</h1>
          <p className="text-[13px] text-gray-500 mt-1">Anciennement: Co-Courtiers</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-[13px] font-medium"
        >
          <Plus size={18} />
          Nouveau courtier
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par raison sociale, code, compte comptable ou pays..."
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

        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="mx-auto text-red-400 mb-2" size={24} />
            <p className="text-[13px] text-red-600">Erreur lors du chargement des courtiers. Veuillez réessayer.</p>
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : coCourtiers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun courtier trouvé</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Raison Sociale</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Compte</th>
                    {/* FIX (new): identifiantUnique / resident columns were entirely
                        absent — confirmed CoCourtier now carries both. */}
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Identifiant Unique</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Résident</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Pays</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Statut</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {coCourtiers.map((c: CoCourtier) => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{c.code}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-900">{c.raisonSociale}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 font-mono">{c.compteComptable || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 font-mono">{c.identifiantUnique || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">
                        {c.resident ? (
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
                      <td className="px-4 py-3 text-[13px] text-gray-600">{c.pays || '-'}</td>
                      <td className="px-4 py-3 text-[13px]">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          c.isActive === false ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
                        }`}>
                          {c.isActive === false ? 'Inactif' : 'Actif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/co-courtiers/${c.id}`)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleEdit(c)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                            title="Modifier"
                          >
                            <Edit2 size={16} />
                          </button>
                          {c.isActive !== false && (
                            <button
                              onClick={() => handleDeactivate(c.id)}
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
              {coCourtiers.map((c: CoCourtier) => (
                <div key={c.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Code</p>
                      <p className="text-[14px] font-semibold text-gray-900">{c.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => navigate(`/co-courtiers/${c.id}`)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                        <Eye size={18} />
                      </button>
                      <button onClick={() => handleEdit(c)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      {c.isActive !== false && (
                        <button onClick={() => handleDeactivate(c.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase font-medium">Raison Sociale</p>
                      <p className="text-[13px] text-gray-900">{c.raisonSociale}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium">Compte Comptable</p>
                        <p className="text-[13px] text-gray-600 font-mono">{c.compteComptable || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium">Identifiant Unique</p>
                        <p className="text-[13px] text-gray-600 font-mono">{c.identifiantUnique || '-'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium">Résident</p>
                        <p className="text-[13px] text-gray-600">{c.resident ? 'Oui (Tunisien)' : 'Non (Étranger)'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium">Pays</p>
                        <p className="text-[13px] text-gray-600">{c.pays || '-'}</p>
                      </div>
                    </div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      c.isActive === false ? 'bg-gray-100 text-gray-500' : 'bg-green-50 text-green-700'
                    }`}>
                      {c.isActive === false ? 'Inactif' : 'Actif'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-[12px] text-gray-500">
                {total} courtier{total !== 1 ? 's' : ''} — page {page} / {totalPages}
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
        <CoCourtierModal coCourtier={editingCoCourtier} onClose={handleCloseModal} />
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
  const [formData, setFormData] = useState<Partial<CoCourtier>>(
    coCourtier || {
      raisonSociale: '',
      compteComptable: '',
      // FIX (new): identifiantUnique / resident were entirely missing from this
      // modal's initial state and inputs, even though CoCourtier is confirmed to
      // carry both fields (matching Cedante/Reassureur).
      identifiantUnique: '',
      resident: true,
      rne: '',
      formeJuridique: '',
      adresse: '',
      pays: 'Tunisie',
      capital: undefined,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['co-courtiers'] });
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

    const compteError = getCoCourtierCompteComptableError(formData.compteComptable);
    if (compteError) {
      setErrors({ compteComptable: compteError });
      return;
    }

    // FIX (new): identifiantUnique/resident validation was entirely absent —
    // mirrors CedanteModal/ReassureurModal now that the field exists here.
    const identifiantError = getCoCourtierIdentifiantUniqueError(formData.identifiantUnique, formData.resident);
    if (identifiantError) {
      setErrors({ identifiantUnique: identifiantError });
      return;
    }

    mutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">
            {coCourtier ? 'Modifier le courtier' : 'Nouveau courtier en réassurance'}
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
                placeholder="401xxxxx"
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

            {/* FIX (new): Résident toggle — was entirely missing from this modal. */}
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

            {/* FIX (new): Identifiant Unique field — was entirely missing from this modal. */}
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
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">RNE</label>
              <input
                type="text"
                name="rne"
                value={formData.rne || ''}
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