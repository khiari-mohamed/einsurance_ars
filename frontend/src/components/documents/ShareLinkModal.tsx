import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { gedApi } from '../../api/ged.api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
}

export default function ShareLinkModal({ isOpen, onClose, documentId, documentName }: Props) {
  const [expiresAt, setExpiresAt] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await gedApi.createShareLink(documentId, {
        expiresAt,
        password: password || undefined,
        email: email || undefined,
        maxDownloads: maxDownloads ? parseInt(maxDownloads) : undefined,
      });
      const fullUrl = `${window.location.origin}${result.url}`;
      setShareLink(fullUrl);
    } catch (error) {
      console.error('Failed to create share link:', error);
      alert('Échec de la création du lien');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Partager le document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">Document: {documentName}</p>

          {!shareLink ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Date d'expiration *</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={getMinDate()}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Mot de passe (optionnel)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Laisser vide pour aucun mot de passe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email (optionnel)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Envoyer le lien par email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Nombre max de téléchargements</label>
                <input
                  type="number"
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(e.target.value)}
                  min="1"
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Illimité si vide"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                >
                  {loading ? 'Création...' : 'Créer le lien'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 mb-2">Lien créé avec succès!</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white border rounded text-sm"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copié' : 'Copier'}
                  </button>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 border rounded-lg hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
