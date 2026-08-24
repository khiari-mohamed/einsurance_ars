import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import api, { extractErrorMessage } from '../../lib/api';
import AuthLayout from './AuthLayout';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const { setAuth } = useAuthStore();
  const navigate    = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Interceptor unwraps { success, data } → data, so response is
      // { accessToken, refreshToken, user } directly.
      const { data } = await api.post('/auth/login', { email, password });
      setAuth(data.accessToken, data.refreshToken, data.user);
      navigate('/');
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Une erreur est survenue lors de la connexion'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Connexion" subtitle="Accédez à votre espace professionnel ARS Tunisie">
      <div className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-[#d1503a]/25 bg-[#d1503a]/10 px-4 py-3 text-sm text-[#c23f2b]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
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

          {/* Password */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-[#171f1a]">Mot de passe</label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-[#8f7038] transition hover:text-[#6b5529]"
              >
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93917f]" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-2xl border border-[#e8e2d2] bg-white pl-11 pr-12 text-sm text-[#171f1a] outline-none transition placeholder:text-[#93917f] focus:border-[#c5a15d] focus:ring-4 focus:ring-[#c5a15d]/20"
                placeholder="Saisissez votre mot de passe"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#93917f] transition hover:text-[#5b6358]"
                tabIndex={-1}
                aria-label={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#c5a15d] to-[#b8914e] text-sm font-semibold text-[#0e1712] transition hover:from-[#b8914e] hover:to-[#a8813f] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-[#0e1712]/30 border-t-[#0e1712] animate-spin" />
                <span>Connexion en cours…</span>
              </>
            ) : (
              <>
                <span>Se connecter</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="rounded-2xl border border-[#c5a15d]/20 bg-[#c5a15d]/5 px-4 py-3 text-sm text-[#5b6358]">
          Pas encore de compte ?{' '}
          <Link to="/register" className="font-semibold text-[#8f7038] transition hover:text-[#6b5529]">
            Créer un compte
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}