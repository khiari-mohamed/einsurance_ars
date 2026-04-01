import { useState, useEffect } from 'react';
import { Download, Trash2, FileText, Calendar, User } from 'lucide-react';
import { gedApi } from '../../api/ged.api';
import { Document, EntityType } from '../../types/ged.types';

interface Props {
  entityType: EntityType;
  entityId: string;
  onRefresh?: number;
}

export default function DocumentList({ entityType, entityId, onRefresh }: Props) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, [entityType, entityId, onRefresh]);

  const loadDocuments = async () => {
    try {
      const data = await gedApi.getEntityDocuments(entityType, entityId);
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const blob = await gedApi.downloadDocument(doc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Échec du téléchargement');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      await gedApi.deleteDocument(id);
      loadDocuments();
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Échec de la suppression');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return <div className="text-center py-8">Chargement...</div>;
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
        <p>Aucun document disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-medium">{doc.fileName}</h3>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  {doc.documentType.replace(/_/g, ' ')}
                </span>
              </div>
              
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(doc.uploadedAt)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}
                </span>
                <span>{formatFileSize(doc.fileSize)}</span>
              </div>

              {doc.description && (
                <p className="mt-2 text-sm text-gray-600">{doc.description}</p>
              )}

              {doc.tags && doc.tags.length > 0 && (
                <div className="mt-2 flex gap-1">
                  {doc.tags.map((tag, i) => (
                    <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 ml-4">
              <button
                onClick={() => handleDownload(doc)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                title="Télécharger"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(doc.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
