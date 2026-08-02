import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileText, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { conventionsApi } from '../../api/master-data.api';

interface Props {
  reassureurId: string;
  onClose: () => void;
}

interface FileEntry {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMsg?: string;
}

export default function ReassureurConventionModal({ reassureurId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dateSignature, setDateSignature] = useState('');
  const [dateEffet, setDateEffet] = useState('');
  const [notes, setNotes] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const remaining = 100 - files.length;
    if (remaining <= 0) return;
    const toAdd = Array.from(incoming).slice(0, remaining);
    setFiles((prev) => [
      ...prev,
      ...toAdd.map((f) => ({ id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`, file: f, status: 'pending' as const })),
    ]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    if (files.length === 0) { setGlobalError('Veuillez sélectionner au moins un fichier.'); return; }
    setSubmitting(true);
    for (const entry of files) {
      if (entry.status === 'done') continue;
      setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'uploading' } : f));
      try {
        const formData = new FormData();
        formData.append('file', entry.file);
        formData.append('partnerType', 'REASSUREUR');
        formData.append('partnerId', reassureurId);
        if (dateSignature) formData.append('dateSignature', dateSignature);
        if (dateEffet) formData.append('dateEffet', dateEffet);
        if (notes.trim()) formData.append('notes', notes.trim());
        await conventionsApi.attach(formData);
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'done' } : f));
      } catch (err: any) {
        const msg = err?.response?.data?.message || "Erreur lors de l'envoi.";
        setFiles((prev) => prev.map((f) => f.id === entry.id ? { ...f, status: 'error', errorMsg: msg } : f));
      }
    }
    setSubmitting(false);
    queryClient.invalidateQueries({ queryKey: ['reassureurs', reassureurId, 'conventions'] });
    queryClient.invalidateQueries({ queryKey: ['reassureurs', reassureurId] });
    const updated = files.filter((f) => f.status !== 'done');
    if (updated.every((f) => f.status === 'done') || files.every((f) => f.status === 'done')) onClose();
  };

  const doneCount = files.filter((f) => f.status === 'done').length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
          <h2 className="text-[18px] font-semibold text-gray-900">Nouvelle convention</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          {globalError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-700">{globalError}</div>}

          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
              Fichiers <span className="text-red-500">*</span>
            </label>
            <div
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-6 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <Upload size={24} className="text-gray-400" />
              <span className="text-[13px] text-gray-600">Cliquez ou glissez-déposez vos fichiers</span>
              <span className="text-[11px] text-gray-400">PDF, Word, Excel, images — tous formats acceptés</span>
              <input ref={inputRef} type="file" multiple onChange={(e) => addFiles(e.target.files)} className="hidden" />
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {files.map((entry) => (
                <div key={entry.id} className={`flex items-center justify-between p-2.5 border rounded-lg text-[12px] ${
                  entry.status === 'done' ? 'border-green-200 bg-green-50' :
                  entry.status === 'error' ? 'border-red-200 bg-red-50' :
                  entry.status === 'uploading' ? 'border-blue-200 bg-blue-50' : 'border-gray-100'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {entry.status === 'done' && <CheckCircle2 size={14} className="text-green-600 shrink-0" />}
                    {entry.status === 'error' && <AlertCircle size={14} className="text-red-500 shrink-0" />}
                    {entry.status === 'uploading' && <div className="w-3.5 h-3.5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin shrink-0" />}
                    {entry.status === 'pending' && <FileText size={14} className="text-gray-400 shrink-0" />}
                    <div className="min-w-0">
                      <p className="truncate text-gray-900">{entry.file.name}</p>
                      {entry.status === 'error' && <p className="text-red-500 text-[11px]">{entry.errorMsg}</p>}
                    </div>
                  </div>
                  {entry.status !== 'uploading' && entry.status !== 'done' && (
                    <button type="button" onClick={() => setFiles((p) => p.filter((f) => f.id !== entry.id))} className="p-1 rounded hover:bg-red-100 text-red-500 shrink-0 ml-2">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date de signature</label>
              <input type="date" value={dateSignature} onChange={(e) => setDateSignature(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date d'effet</label>
              <input type="date" value={dateEffet} onChange={(e) => setDateEffet(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            {files.length > 1 && <p className="mt-1 text-[11px] text-gray-400">Ces métadonnées s'appliquent à tous les fichiers.</p>}
          </div>
        </form>

        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-100 shrink-0">
          <div className="text-[12px] text-gray-400">
            {submitting && `${doneCount} / ${files.length} envoyé${doneCount > 1 ? 's' : ''}...`}
            {!submitting && files.length > 0 && `${files.length} fichier${files.length > 1 ? 's' : ''} sélectionné${files.length > 1 ? 's' : ''}`}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Annuler
            </button>
            <button
              onClick={handleSubmit as any}
              disabled={submitting || files.length === 0}
              className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
