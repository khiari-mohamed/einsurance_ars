import { Clock } from 'lucide-react';

export default function WorkflowHistory() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Historique Workflow</h1>

      <div className="bg-white rounded-lg shadow p-8 text-center">
        <Clock className="mx-auto text-gray-400 mb-4" size={48} />
        <p className="text-gray-500">Aucun historique disponible</p>
      </div>
    </div>
  );
}
