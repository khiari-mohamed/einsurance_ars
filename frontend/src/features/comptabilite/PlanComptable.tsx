import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, RefreshCw } from 'lucide-react';
import comptabiliteApi from '@/api/comptabilite.api';
import { toast } from 'sonner';

// FIX (Comptabilité pass): full rewrite. `type` is a free string
// (DEBIT_NORMAL/CREDIT_NORMAL), not the fictional enum used before; delete
// now really deactivates (was calling a route that never existed).
export default function PlanComptable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [classe, setClasse] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ compte: '', libelle: '', type: 'DEBIT_NORMAL', classe: '6', isAuxiliary: false });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['plan-comptable', search, classe],
    queryFn: async () => (await comptabiliteApi.getPlanComptable(search || undefined, classe || undefined)).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['plan-comptable'] });

  const createMutation = useMutation({
    mutationFn: () => comptabiliteApi.createPlanComptable(form),
    onSuccess: () => { toast.success('Compte créé'); setShowForm(false); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => comptabiliteApi.deletePlanComptable(id),
    onSuccess: () => { toast.success('Compte désactivé'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  const seedMutation = useMutation({
    mutationFn: () => comptabiliteApi.seedPlanComptable(),
    onSuccess: ({ data }) => { toast.success(`${data.seeded} compte(s) initialisé(s)`); invalidate(); },
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Plan Comptable</h1>
        <div className="flex gap-2">
          <button onClick={() => seedMutation.mutate()} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">
            <RefreshCw size={16} /> Initialiser les comptes de base
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            <Plus size={16} /> Nouveau Compte
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input placeholder="Rechercher compte ou libellé..." value={search} onChange={(e) => setSearch(e.target.value)} className="px-3 py-2 border rounded-lg text-sm flex-1" />
        <select value={classe} onChange={(e) => setClasse(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Toutes classes</option>
          {['1', '2', '3', '4', '5', '6', '7'].map((c) => <option key={c} value={c}>Classe {c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Compte</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classe</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Auxiliaire</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucun compte — cliquez "Initialiser les comptes de base" pour démarrer</td></tr>
            ) : (
              accounts.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{a.compte}</td>
                  <td className="px-4 py-3 text-sm">{a.libelle}</td>
                  <td className="px-4 py-3 text-sm">{a.classe}</td>
                  <td className="px-4 py-3 text-sm">{a.type === 'DEBIT_NORMAL' ? 'Débiteur' : 'Créditeur'}</td>
                  <td className="px-4 py-3 text-sm">{a.isAuxiliary ? 'Oui' : 'Non'}</td>
                  <td className="px-4 py-3 text-sm">
                    <button onClick={() => deleteMutation.mutate(a.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold">Nouveau Compte</h2>
            <div>
              <label className="text-sm font-medium">Numéro de compte</label>
              <input value={form.compte} onChange={(e) => setForm({ ...form, compte: e.target.value })} className="w-full border rounded px-3 py-2 text-sm font-mono" placeholder="41130000" />
            </div>
            <div>
              <label className="text-sm font-medium">Libellé</label>
              <input value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Classe</label>
                <select value={form.classe} onChange={(e) => setForm({ ...form, classe: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
                  {['1', '2', '3', '4', '5', '6', '7'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
                  <option value="DEBIT_NORMAL">Débiteur</option>
                  <option value="CREDIT_NORMAL">Créditeur</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isAuxiliary} onChange={(e) => setForm({ ...form, isAuxiliary: e.target.checked })} /> Compte auxiliaire (par tiers)</label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Annuler</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}