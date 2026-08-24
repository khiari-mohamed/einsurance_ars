import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight } from 'lucide-react';
import api, { extractErrorMessage } from '../../lib/api';
import AuthLayout from './AuthLayout';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [message, setMessage] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      // FIX (bug #1): backend route is /auth/forgot-password, not
      // /auth/request-password-reset (auth.controller.ts). The backend
      // resolves this to void — it deliberately doesn't return a message
      // (silent on unknown emails, per AuthService.forgotPassword), so we
      // always show a generic confirmation regardless of response body.
      await api.post('/auth/forgot-password', { email });
      setMessage('Si un compte existe avec cette adresse, un e-mail avec les instructions vous a été envoyé.');
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Réinitialiser le mot de passe"
      subtitle="Saisissez votre adresse e-mail pour recevoir les instructions"
    >
      <div className="space-y-5">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#5b6358] transition hover:text-[#8f7038]"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>

        {error && (
          <div className="rounded-2xl border border-[#d1503a]/25 bg-[#d1503a]/10 px-4 py-3 text-sm text-[#c23f2b]">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-2xl border border-[#4a9d63]/25 bg-[#4a9d63]/10 px-4 py-3 text-sm text-[#3d8353]">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#171f1a]">
              Adresse e-mail
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93917f]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-2xl border border-[#e8e2d2] bg-white pl-11 pr-4 text-sm text-[#171f1a] outline-none transition placeholder:text-[#93917f] focus:border-[#c5a15d] focus:ring-4 focus:ring-[#c5a15d]/20"
                placeholder="prenom.nom@arstunisie.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !!message}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#c5a15d] to-[#b8914e] text-sm font-semibold text-[#0e1712] transition hover:from-[#b8914e] hover:to-[#a8813f] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-[#0e1712]/30 border-t-[#0e1712] animate-spin" />
                <span>Envoi en cours…</span>
              </>
            ) : (
              <>
                <span>Envoyer le lien</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}