import { useQuery } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import api from '../../lib/api';

export default function UserManagement() {
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data;
    },
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-3xl font-semibold text-foreground">Gestion des Utilisateurs</h1>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90">
          <Plus size={20} />
          Nouvel Utilisateur
        </button>
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-card rounded-[var(--radius)] border border-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users?.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">{user.firstName} {user.lastName}</td>
                  <td className="px-6 py-4 text-sm">{user.email}</td>
                  <td className="px-6 py-4 text-sm uppercase">{user.role}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs rounded-full ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {user.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button className="text-blue-600 hover:text-blue-800"><Edit size={18} /></button>
                    <button className="text-red-600 hover:text-red-800"><Trash2 size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
