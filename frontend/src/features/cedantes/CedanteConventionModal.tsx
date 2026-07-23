import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileText } from 'lucide-react';
import { conventionsApi } from '../../api/master-data.api';

interface CedanteConventionModalProps {
  cedanteId: string;
  onClose: () => void;
}

export default function CedanteConventionModal({ cedanteId, onClose }: CedanteConventionModalProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [dateSignature, setDateSignature] = useState('');
  const [dateEffet, setDateEffet] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (formData: FormData) => conventionsApi.attach(formData),
    onSuccess: () => {
      // Conventions go through GedService.upload(), which may also create a
      // generic DocumentLink row — invalidate both queries so either view
      // (Conventions tab or the read-only GED list) stays in sync.
      queryClient.invalidateQueries({ queryKey: ['cedantes', cedanteId, 'conventions'] });
      queryClient.invalidateQueries({ queryKey: ['cedantes', cedanteId] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || "Erreur lors de l'envoi de la convention.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Matches ConventionsService.attach()'s own guard ("Aucun fichier reçu.") —
    // checked client-side too so the user gets immediate feedback.
    if (!file) {
      setError('Veuillez sélectionner un fichier.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('partnerType', 'CEDANTE');
    formData.append('partnerId', cedanteId);
    // dateSignature/dateEffet are @IsOptional() @IsISO8601() on the backend —
    // an <input type="date"> already yields 'YYYY-MM-DD', a valid ISO 8601
    // calendar date, so no reformatting is needed. Omit entirely if empty
    // rather than sending an empty string (which would fail @IsISO8601()).
    if (dateSignature) formData.append('dateSignature', dateSignature);
    if (dateEffet) formData.append('dateEffet', dateEffet);
    if (notes.trim()) formData.append('notes', notes.trim());

    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">Nouvelle convention</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Fichier (convention signée) <span className="text-red-500">*</span>
              </label>
              {file ? (
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={16} className="text-blue-600 shrink-0" />
                    <span className="text-[13px] text-gray-900 truncate">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-[12px] text-red-600 hover:text-red-700 font-medium shrink-0 ml-2"
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-6 cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload size={24} className="text-gray-400" />
                  <span className="text-[13px] text-gray-600">Cliquez pour choisir un fichier</span>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
              {mutation.isPending ? 'Envoi en cours...' : 'Ajouter la convention'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}