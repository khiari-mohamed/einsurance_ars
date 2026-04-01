import { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface SWIFTUploadProps {
  paymentId: string;
  paymentReference: string;
  montant: number;
  devise: string;
  beneficiaire: string;
  onUploadComplete?: () => void;
}

export default function SWIFTUpload({
  paymentId,
  paymentReference,
  montant,
  devise,
  beneficiaire,
  onUploadComplete,
}: SWIFTUploadProps) {
  const [swiftFile, setSwiftFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [swiftUrl, setSwiftUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        toast.error('Format non supporté. Utilisez PDF, JPG ou PNG');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Fichier trop volumineux (max 5MB)');
        return;
      }

      setSwiftFile(file);
    }
  };

  const handleUpload = async () => {
    if (!swiftFile) {
      toast.error('Veuillez sélectionner un fichier');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', swiftFile);
    formData.append('paymentId', paymentId);
    formData.append('documentType', 'swift_confirmation');

    try {
      const res = await fetch('/api/ged/upload-swift', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setSwiftUrl(data.fileUrl);
        setUploaded(true);
        toast.success('Confirmation SWIFT téléchargée avec succès');
        
        // Update payment status
        await fetch(`/api/finances/payments/${paymentId}/swift-confirmed`, {
          method: 'PUT',
        });

        if (onUploadComplete) onUploadComplete();
      } else {
        toast.error('Erreur lors du téléchargement');
      }
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setSwiftFile(null);
  };

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="text-blue-600" size={24} />
        <div>
          <h3 className="font-semibold">Confirmation SWIFT</h3>
          <p className="text-sm text-gray-600">Paiement: {paymentReference}</p>
        </div>
      </div>

      {/* Payment Info */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">Montant:</span>
            <span className="ml-2 font-semibold">
              {montant.toLocaleString()} {devise}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Bénéficiaire:</span>
            <span className="ml-2 font-semibold">{beneficiaire}</span>
          </div>
        </div>
      </div>

      {!uploaded ? (
        <>
          {/* Upload Status Alert */}
          <div className="mb-4 p-3 bg-orange-50 border-l-4 border-orange-500 rounded flex items-start gap-2">
            <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm">
              <p className="font-semibold text-orange-800">SWIFT en attente</p>
              <p className="text-orange-700">
                Le paiement reste en attente jusqu'à réception de la confirmation SWIFT
              </p>
            </div>
          </div>

          {/* File Input */}
          {!swiftFile ? (
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <Upload className="mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-sm font-medium text-gray-700">Cliquez pour sélectionner le fichier SWIFT</p>
                <p className="text-xs text-gray-500 mt-1">PDF, JPG ou PNG (max 5MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
              />
            </label>
          ) : (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="text-blue-600" size={24} />
                  <div>
                    <p className="font-medium">{swiftFile.name}</p>
                    <p className="text-xs text-gray-500">{(swiftFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button
                  onClick={removeFile}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <X size={18} />
                </button>
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Upload size={16} />
                {uploading ? 'Téléchargement...' : 'Télécharger la Confirmation'}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Success State */}
          <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded flex items-start gap-2 mb-4">
            <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={18} />
            <div className="text-sm flex-1">
              <p className="font-semibold text-green-800">Confirmation SWIFT reçue</p>
              <p className="text-green-700">Le paiement est maintenant confirmé</p>
            </div>
          </div>

          {/* Download Link */}
          {swiftUrl && (
            <a
              href={swiftUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Download size={16} />
              Télécharger la Confirmation
            </a>
          )}
        </>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-gray-700">
        <p className="font-semibold mb-1">À propos de la confirmation SWIFT</p>
        <ul className="space-y-1">
          <li>• Document officiel de la banque confirmant le virement</li>
          <li>• Requis pour la validation comptable du paiement</li>
          <li>• Une notification sera envoyée au chargé de dossier</li>
        </ul>
      </div>
    </div>
  );
}
