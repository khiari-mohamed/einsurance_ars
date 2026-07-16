import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, X, Eye } from 'lucide-react';
import { assuresApi } from '../../api/master-data.api';
import { Assure } from '../../types/assure.types';

export default function AssuresList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssure, setEditingAssure] = useState<Assure | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: assures = [], isLoading, error } = useQuery({
    queryKey: ['assures'],
    queryFn: async () => {
      const { data } = await assuresApi.getAll();
      return data.data;
    },
  });

  if (error) {
    console.error('Error loading assures:', error);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assuresApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assures'] });
    },
  });

  const filteredAssures = assures.filter((assure: Assure) =>
    assure.raisonSociale?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assure.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assure.rne?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assure.pays?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (assure: Assure) => {
    setEditingAssure(assure);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAssure(null);
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-[24px] font-semibold text-gray-900">Clients</h1>
          <p className="text-[13px] text-gray-500 mt-1">Anciennement: Assurés</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-[13px] font-medium"
        >
          <Plus size={18} />
          Nouveau client
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par raison sociale, code, RNE ou pays..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : filteredAssures.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun client trouvé</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Raison Sociale</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">RNE</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Pays</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAssures.map((assure: Assure) => (
                    <tr key={assure.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{assure.code}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-900">{assure.raisonSociale}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600 font-mono">{assure.rne || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">{assure.pays || '-'}</td>
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
                          <button
                            onClick={() => handleDelete(assure.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {filteredAssures.map((assure: Assure) => (
                <div key={assure.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Code</p>
                      <p className="text-[14px] font-semibold text-gray-900">{assure.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/assures/${assure.id}`)}
                        className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(assure)}
                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(assure.id)}
                        className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
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
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <AssureModal
          assure={editingAssure}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

// --- Assure Modal Component (4 tabs — no bank accounts, no compte comptable) ---

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
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">
            {assure ? 'Modifier le client' : 'Nouveau client'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
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
            {/* Raison Sociale */}
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

            {/* RNE (legacy) */}
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

            {/* Forme Juridique */}
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

            {/* Adresse */}
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

            {/* Pays */}
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

            {/* Capital */}
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
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
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