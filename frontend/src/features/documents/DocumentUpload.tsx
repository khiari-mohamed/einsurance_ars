import { useState, useEffect } from 'react';
import { Search, FileText, HardDrive, Upload, Download, Share2, AlertCircle } from 'lucide-react';
import { gedApi } from '../../api/ged.api';
import { Document, SearchDocumentDto, DocumentStatistics, EntityType, DocumentType } from '../../types/ged.types';
import BulkUploadModal from '../../components/documents/BulkUploadModal';
import ShareLinkModal from '../../components/documents/ShareLinkModal';
import ComplianceDashboard from '../../components/documents/ComplianceDashboard';

export default function DocumentUpload() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [statistics, setStatistics] = useState<DocumentStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchDocumentDto>({});
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const [showCompliance, setShowCompliance] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [docs, stats] = await Promise.all([
        gedApi.getDocuments(filters),
        gedApi.getStatistics(),
      ]);
      setDocuments(docs);
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const docs = await gedApi.getDocuments({ ...filters, search: searchQuery });
      setDocuments(docs);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedDocs.length === 0) return;
    try {
      const blob = await gedApi.bulkDownload(selectedDocs);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'documents.zip';
      a.click();
      window.URL.revokeObjectURL(url);
      setSelectedDocs([]);
    } catch (error) {
      console.error('Bulk download failed:', error);
      alert('Échec du téléchargement groupé');
    }
  };

  const toggleSelectDoc = (id: string) => {
    setSelectedDocs(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Gestion Électronique des Documents</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCompliance(!showCompliance)}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            Conformité
          </button>
          <button
            onClick={() => setShowBulkUpload(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Téléchargement groupé
          </button>
          {selectedDocs.length > 0 && (
            <button
              onClick={handleBulkDownload}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Télécharger ({selectedDocs.length})
            </button>
          )}
        </div>
      </div>

      {showCompliance && (
        <div className="mb-6">
          <ComplianceDashboard />
        </div>
      )}

      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Documents</p>
                <p className="text-3xl font-bold text-gray-800">{statistics.total}</p>
              </div>
              <FileText className="w-12 h-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Espace Utilisé</p>
                <p className="text-3xl font-bold text-gray-800">{formatBytes(statistics.totalSize)}</p>
              </div>
              <HardDrive className="w-12 h-12 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div>
              <p className="text-sm text-gray-600 mb-2">Par Type</p>
              <div className="space-y-1">
                {statistics.byType.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.type}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Rechercher des documents..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Rechercher
            </button>
          </div>

          <div className="mt-4 flex gap-4">
            <select
              value={filters.entityType || ''}
              onChange={(e) => setFilters({ ...filters, entityType: e.target.value as EntityType || undefined })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">Tous les types d'entité</option>
              <option value={EntityType.AFFAIRE}>Affaire</option>
              <option value={EntityType.SINISTRE}>Sinistre</option>
              <option value={EntityType.CEDANTE}>Cédante</option>
              <option value={EntityType.REASSUREUR}>Réassureur</option>
            </select>

            <select
              value={filters.documentType || ''}
              onChange={(e) => setFilters({ ...filters, documentType: e.target.value as DocumentType || undefined })}
              className="border rounded-lg px-3 py-2"
            >
              <option value="">Tous les types de document</option>
              <option value={DocumentType.SLIP_COTATION}>Slip de cotation</option>
              <option value={DocumentType.BORDEREAU_CESSION}>Bordereau de cession</option>
              <option value={DocumentType.AVIS_SINISTRE}>Avis de sinistre</option>
              <option value={DocumentType.PAYMENT_ORDER}>Ordre de paiement</option>
            </select>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">Chargement...</div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>Aucun document trouvé</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedDocs.includes(doc.id)}
                        onChange={() => toggleSelectDoc(doc.id)}
                        className="w-4 h-4"
                      />
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <h3 className="font-medium">{doc.fileName}</h3>
                        <p className="text-sm text-gray-600">
                          {doc.documentType.replace(/_/g, ' ')} • {doc.entityType}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-600">
                        {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}
                      </div>
                      <button
                        onClick={() => setShareDoc(doc)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Partager"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        entityType={EntityType.AFFAIRE}
        entityId=""
        onSuccess={loadData}
      />

      {shareDoc && (
        <ShareLinkModal
          isOpen={true}
          onClose={() => setShareDoc(null)}
          documentId={shareDoc.id}
          documentName={shareDoc.fileName}
        />
      )}
    </div>
  );
}
