import { useState, useEffect } from 'react';
import { Plus, Upload, AlertTriangle } from 'lucide-react';
import DocumentList from './DocumentList';
import DocumentUploadModal from './DocumentUploadModal';
import BulkUploadModal from './BulkUploadModal';
import { EntityType } from '../../types/ged.types';
import { gedApi } from '../../api/ged.api';

interface Props {
  entityType: EntityType;
  entityId: string;
}

export default function EntityDocuments({ entityType, entityId }: Props) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [compliance, setCompliance] = useState<any>(null);

  useEffect(() => {
    loadCompliance();
  }, [entityType, entityId, refreshKey]);

  const loadCompliance = async () => {
    try {
      const data = await gedApi.checkCompliance(entityType, entityId);
      setCompliance(data);
    } catch (error) {
      console.error('Failed to load compliance:', error);
    }
  };

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Documents</h2>
          {compliance && compliance.warnings.length > 0 && (
            <div className="flex items-center gap-2 mt-1 text-sm text-yellow-600">
              <AlertTriangle className="w-4 h-4" />
              <span>{compliance.warnings.join(', ')}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
          <button
            onClick={() => setIsBulkUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Upload className="w-4 h-4" />
            Groupé
          </button>
        </div>
      </div>

      <DocumentList
        entityType={entityType}
        entityId={entityId}
        onRefresh={refreshKey}
      />

      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        entityType={entityType}
        entityId={entityId}
        onSuccess={handleUploadSuccess}
      />

      <BulkUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        entityType={entityType}
        entityId={entityId}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
