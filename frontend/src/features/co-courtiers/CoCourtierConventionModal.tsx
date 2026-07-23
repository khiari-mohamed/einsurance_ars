import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Upload } from 'lucide-react';
import { conventionsApi } from '../../api/master-data.api';

interface Props {
  coCourtierId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function CoCourtierConventionModal({ coCourtierId, onClose, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dateSignature, setDateSignature] = useState('');
  const [dateEffet, setDateEffet] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (formData: FormData) => conventionsApi.attach(formData),
    onSuccess: () => onSaved(),
    onError: (err: any) => {
      setError(err.response?.data?.message || "Erreur lors de l'envoi de la convention.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Veuillez sélectionner un fichier (convention signée).');
      return;
    }
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('partnerType', 'CO_COURTIER');
    formData.append('partnerId', coCourtierId);
    if (dateSignature) formData.append('dateSignature', dateSignature);
    if (dateEffet) formData.append('dateEffet', dateEffet);
    if (notes) formData.append('notes', notes);
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[16px] font-semibold text-gray-900">Joindre une convention</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
              Convention signée (PDF, image...) <span className="text-red-500">*</span>
            </label>
            <label className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <Upload size={18} className="text-gray-400" />
              <span className="text-[13px] text-gray-600">{file ? file.name : 'Choisir un fichier'}</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date de signature</label>
              <input
                type="date"
                value={dateSignature}
                onChange={(e) => setDateSignature(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date d'effet</label>
              <input
                type="date"
                value={dateEffet}
                onChange={(e) => setDateEffet(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {mutation.isPending ? 'Envoi...' : 'Joindre'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}