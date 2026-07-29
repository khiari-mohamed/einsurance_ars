import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, XCircle } from 'lucide-react';
import comptabiliteApi from '@/api/comptabilite.api';
import { formatDate } from '@/lib/currency';
import { toast } from 'sonner';

function downloadContent(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = window.URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

export default function Export() {
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<'SAGE' | 'CSV_GENERIC'>('SAGE');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [codeJournal, setCodeJournal] = useState('');

  const { data: batches } = useQuery({
    queryKey: ['export-batches'],
    queryFn: async () => (await comptabiliteApi.listExportBatches(1, 20)).data,
  });

  const generateMutation = useMutation({
    mutationFn: () => comptabiliteApi.generateIntegrationExport({ format, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, codeJournal: codeJournal || undefined }),
    onSuccess: ({ data }) => {
      downloadContent(data.content, `export-${data.reference}.${format === 'SAGE' ? 'txt' : 'csv'}`);
      toast.success(`Lot ${data.reference} — ${data.entryCount} écriture(s) exportée(s)`);
      queryClient.invalidateQueries({ queryKey: ['export-batches'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur lors de l\'export'),
  });

  const redownloadMutation = useMutation({
    mutationFn: (id: string) => comptabiliteApi.getExportBatch(id),
    onSuccess: ({ data }) => downloadContent(data.content, `export-${data.reference}.txt`),
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => comptabiliteApi.voidExportBatch(id),
    onSuccess: () => { toast.success('Lot annulé — écritures libérées pour un nouvel export'); queryClient.invalidateQueries({ queryKey: ['export-batches'] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Fichier d'Intégration</h1>
      <p className="text-sm text-gray-500 mb-6">
        Exporte les écritures validées non encore transmises. Une fois exportée, une écriture n'est plus reproposée
        dans un export ultérieur — utilisez "Réannuler" ci-dessous si un lot doit être régénéré.
      </p>

      <div className="bg-white rounded-lg shadow p-4 space-y-3 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as any)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="SAGE">SAGE</option>
              <option value="CSV_GENERIC">CSV générique</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Code journal (optionnel)</label>
            <input value={codeJournal} onChange={(e) => setCodeJournal(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="ex: ACH, VTE" />
          </div>
          <div>
            <label className="text-sm font-medium">Date début</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium">Date fin</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>
        <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
          <Download size={16} /> {generateMutation.isPending ? 'Génération...' : 'Générer et Télécharger'}
        </button>
      </div>

      <h2 className="font-semibold mb-2">Historique des exports</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Référence</th><th className="px-3 py-2 text-left">Format</th>
              <th className="px-3 py-2 text-left">Écritures</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(batches?.data ?? []).length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Aucun export généré</td></tr>
            ) : (
              batches!.data.map((b: any) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono">{b.reference}</td>
                  <td className="px-3 py-2">{b.format}</td>
                  <td className="px-3 py-2">{b.entryCount}</td>
                  <td className="px-3 py-2">{formatDate(b.createdAt)}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button onClick={() => redownloadMutation.mutate(b.id)} className="text-blue-600 hover:underline inline-flex items-center gap-1"><Download size={13} /> Retélécharger</button>
                    <button onClick={() => voidMutation.mutate(b.id)} className="text-red-600 hover:underline inline-flex items-center gap-1"><XCircle size={13} /> Annuler le lot</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}