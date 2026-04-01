import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, Trash2, FileText } from 'lucide-react';
import { sinistresApi } from '../../api/sinistres.api';

interface Props {
  sinistreId: string;
}

const documentTypes = [
  { value: 'AVIS_SINISTRE', label: 'Avis de Sinistre' },
  { value: 'RAPPORT_EXPERTISE', label: 'Rapport d\'Expertise' },
  { value: 'PREUVE_PAIEMENT', label: 'Preuve de Paiement' },
  { value: 'CORRESPONDANCE', label: 'Correspondance' },
  { value: 'AUTRE', label: 'Autre' },
];

export default function SinistreDocuments({ sinistreId }: Props) {
  const queryClient = useQueryClient();
  const [, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState('AVIS_SINISTRE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: documents } = useQuery({
    queryKey: ['sinistre-documents', sinistreId],
    queryFn: async () => {
      const { data } = await sinistresApi.getDocuments(sinistreId);
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) return;
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', selectedType);
      formData.append('nom', selectedFile.name);
      return sinistresApi.uploadDocument(sinistreId, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-documents', sinistreId] });
      setSelectedFile(null);
      setUploading(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => sinistresApi.deleteDocument(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-documents', sinistreId] });
    },
  });

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-4">Télécharger un document</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de document</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {documentTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Fichier</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploadMutation.isPending}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Upload size={18} />
            {uploadMutation.isPending ? 'Upload...' : 'Upload'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-4">Documents ({documents?.length || 0})</h3>
        {documents?.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            Aucun document
          </div>
        ) : (
          <div className="space-y-2">
            {documents?.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileText className="text-blue-600" size={24} />
                  <div>
                    <div className="font-medium">{doc.nom}</div>
                    <div className="text-sm text-gray-600">
                      {documentTypes.find(t => t.value === doc.type)?.label} • {new Date(doc.dateUpload).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const { data } = await sinistresApi.getDocumentUrl(doc.id);
                      window.open(data.url, '_blank');
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(doc.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
