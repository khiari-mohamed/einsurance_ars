import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comptabiliteApi, Account } from '../../api/comptabilite.api';
import { toast } from 'sonner';

export default function PlanComptable() {
  const [search, setSearch] = useState('');
  const [selectedClasse, setSelectedClasse] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', selectedClasse],
    queryFn: () => comptabiliteApi.getAccounts({ classe: selectedClasse || undefined }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => comptabiliteApi.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Compte désactivé');
    },
  });

  const filteredAccounts = accounts.filter((a: Account) =>
    a.code.toLowerCase().includes(search.toLowerCase()) ||
    a.libelle.toLowerCase().includes(search.toLowerCase())
  );

  const groupedAccounts = filteredAccounts.reduce((acc: any, account: Account) => {
    if (!acc[account.classe]) acc[account.classe] = [];
    acc[account.classe].push(account);
    return acc;
  }, {});

  const classeLabels: Record<string, string> = {
    '1': 'Classe 1 - Capitaux',
    '2': 'Classe 2 - Immobilisations',
    '3': 'Classe 3 - Stocks',
    '4': 'Classe 4 - Tiers',
    '5': 'Classe 5 - Financiers',
    '6': 'Classe 6 - Charges',
    '7': 'Classe 7 - Produits',
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Plan Comptable</h1>
        <button
          onClick={() => { setEditingAccount(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Nouveau Compte
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher un compte..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedClasse('')}
              className={`px-3 py-1 rounded ${!selectedClasse ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
            >
              Tous
            </button>
            {['1', '2', '3', '4', '5', '6', '7'].map(c => (
              <button
                key={c}
                onClick={() => setSelectedClasse(c)}
                className={`px-3 py-1 rounded ${selectedClasse === c ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
              >
                Classe {c}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {isLoading ? (
            <p className="text-center py-8 text-gray-500">Chargement...</p>
          ) : filteredAccounts.length === 0 ? (
            <p className="text-center py-8 text-gray-500">Aucun compte trouvé</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAccounts).map(([classe, accts]: [string, any]) => (
                <div key={classe}>
                  <h3 className="font-semibold text-lg mb-3">{classeLabels[classe]}</h3>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Code</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Libellé</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Statut</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {accts.map((account: Account) => (
                        <tr key={account.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono">{account.code}</td>
                          <td className="px-4 py-3 text-sm">{account.libelle}</td>
                          <td className="px-4 py-3 text-sm capitalize">{account.type}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {account.isActive ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <button
                              onClick={() => { setEditingAccount(account); setShowModal(true); }}
                              className="text-blue-600 hover:text-blue-800 mr-3"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(account.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => { setShowModal(false); setEditingAccount(null); }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            setShowModal(false);
            setEditingAccount(null);
          }}
        />
      )}
    </div>
  );
}

function AccountModal({ account, onClose, onSuccess }: { account: Account | null; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    code: account?.code || '',
    libelle: account?.libelle || '',
    type: account?.type || 'actif',
    classe: account?.classe || '1',
    description: account?.description || '',
  });

  const mutation = useMutation({
    mutationFn: (data: any) => account
      ? comptabiliteApi.updateAccount(account.id, data)
      : comptabiliteApi.createAccount(data),
    onSuccess: () => {
      toast.success(account ? 'Compte modifié' : 'Compte créé');
      onSuccess();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">{account ? 'Modifier' : 'Nouveau'} Compte</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Code</label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Libellé</label>
            <input
              type="text"
              value={formData.libelle}
              onChange={(e) => setFormData({ ...formData, libelle: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="actif">Actif</option>
              <option value="passif">Passif</option>
              <option value="charge">Charge</option>
              <option value="produit">Produit</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Classe</label>
            <select
              value={formData.classe}
              onChange={(e) => setFormData({ ...formData, classe: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {['1', '2', '3', '4', '5', '6', '7'].map(c => (
                <option key={c} value={c}>Classe {c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Annuler</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {account ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
