import { Download, Upload } from 'lucide-react';

export default function BackupRestore() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Sauvegarde & Restauration</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-4">Créer une sauvegarde</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            <Download size={20} />
            Sauvegarder
          </button>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold mb-4">Restaurer</h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
            <Upload size={20} />
            Restaurer
          </button>
        </div>
      </div>
    </div>
  );
}
