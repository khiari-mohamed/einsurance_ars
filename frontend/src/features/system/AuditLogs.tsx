import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export default function AuditLogs() {
  const { data: logs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data } = await api.get('/system/audit-logs');
      return data;
    },
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Journal d'Audit</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Utilisateur</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs?.map((log: any) => (
              <tr key={log.id}>
                <td className="px-6 py-4 text-sm">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-6 py-4 text-sm">{log.userId}</td>
                <td className="px-6 py-4 text-sm">{log.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
