import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import api, { extractErrorMessage } from '../../lib/api';
import AuthLayout from './AuthLayout';

const MIN_PASSWORD_LENGTH = 8; // matches backend PasswordPolicy.longueurMin default

export default function ResetPasswordPage() {
  const [searchParams]                    = useSearchParams();
  const token                             = searchParams.get('token');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirm]     = useState('');
  const [showPwd,    setShowPwd]          = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [message, setMessage]             = useState('');
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', {
        token,
        newPassword: password,
      });
      setMessage(data.message ?? 'Mot de passe réinitialisé avec succès.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'La réinitialisation a échoué.'));
    } finally {
      setLoading(false);
    }
  };

  // Guard — invalid / missing token
  if (!token) {
    return (
      <AuthLayout title="Lien invalide" subtitle="Le lien de réinitialisation est invalide ou a expiré">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#d1503a]/25 bg-[#d1503a]/10 px-4 py-3 text-sm text-[#c23f2b]">
            Ce lien de réinitialisation est invalide ou a expiré. Veuillez en demander un nouveau.
          </div>
          <Link
            to="/forgot-password"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#c5a15d] to-[#b8914e] text-sm font-semibold text-[#0e1712] transition hover:from-[#b8914e] hover:to-[#a8813f]"
          >
            Demander un nouveau lien
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Nouveau mot de passe"
      subtitle="Choisissez un nouveau mot de passe sécurisé"
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-[#d1503a]/25 bg-[#d1503a]/10 px-4 py-3 text-sm text-[#c23f2b]">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-2xl border border-[#4a9d63]/25 bg-[#4a9d63]/10 px-4 py-3 text-sm text-[#3d8353] flex items-center gap-2">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[#171f1a]">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93917f]" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-2xl border border-[#e8e2d2] bg-white pl-11 pr-12 text-sm text-[#171f1a] outline-none transition placeholder:text-[#93917f] focus:border-[#c5a15d] focus:ring-4 focus:ring-[#c5a15d]/20"
                placeholder={`Minimum ${MIN_PASSWORD_LENGTH} caractères`}
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
                aria-label={showPwd ? 'Masquer' : 'Afficher'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#93917f] transition hover:text-[#5b6358]"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[#171f1a]">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93917f]" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12 w-full rounded-2xl border border-[#e8e2d2] bg-white pl-11 pr-12 text-sm text-[#171f1a] outline-none transition placeholder:text-[#93917f] focus:border-[#c5a15d] focus:ring-4 focus:ring-[#c5a15d]/20"
                placeholder="Confirmez votre mot de passe"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                tabIndex={-1}
                aria-label={showConfirm ? 'Masquer' : 'Afficher'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#93917f] transition hover:text-[#5b6358]"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
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
                <span>Réinitialisation…</span>
              </>
            ) : (
              <>
                <span>Réinitialiser le mot de passe</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}