import React, { useState } from 'react';
import { swiftApi } from '../../api/extended.api';

interface Props {
  decaissementId: string;
  onUploadComplete: () => void;
}

export const SwiftUploadModal: React.FC<Props> = ({ decaissementId, onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [swiftUrl, setSwiftUrl] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file && !swiftUrl) {
      alert('Veuillez sélectionner un fichier ou entrer une URL');
      return;
    }

    setUploading(true);
    try {
      let documentUrl = swiftUrl;
      
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        const uploadData = await uploadResponse.json();
        documentUrl = uploadData.url;
      }

      await swiftApi.uploadConfirmation(decaissementId, documentUrl);
      alert('Confirmation SWIFT enregistrée avec succès');
      onUploadComplete();
    } catch (error) {
      console.error('Failed to upload SWIFT confirmation:', error);
      alert('Erreur lors de l\'enregistrement de la confirmation SWIFT');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="swift-upload-modal">
      <h3>Joindre Confirmation SWIFT</h3>
      
      <div className="upload-section">
        <div className="form-group">
          <label>Fichier SWIFT (PDF, Image)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {file && <p className="file-name">Fichier sélectionné: {file.name}</p>}
        </div>

        <div className="separator">OU</div>

        <div className="form-group">
          <label>URL du Document</label>
          <input
            type="text"
            value={swiftUrl}
            onChange={(e) => setSwiftUrl(e.target.value)}
            placeholder="https://..."
            disabled={uploading}
          />
        </div>
      </div>

      <div className="modal-actions">
        <button 
          onClick={handleUpload} 
          disabled={uploading || (!file && !swiftUrl)}
          className="btn-primary"
        >
          {uploading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
};
