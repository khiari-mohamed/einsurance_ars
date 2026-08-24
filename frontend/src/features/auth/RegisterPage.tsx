import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User as UserIcon, ArrowRight, ArrowLeft } from 'lucide-react';
import api, { extractErrorMessage } from '../../lib/api';
import AuthLayout from './AuthLayout';

const ROLES = [
  { value: 'DIRECTION_GENERALE',    label: 'Direction Générale' },
  { value: 'DIRECTION_COMMERCIALE', label: 'Direction Commerciale' },
  { value: 'DIRECTION_REASSURANCE', label: 'Direction Réassurance' },
  { value: 'DAF',                   label: 'DAF' },
  { value: 'SERVICE_IRDS',          label: 'Service IRDS' },
  { value: 'SUPER_ADMIN',           label: 'Super Administrateur' },
] as const;

const MIN_PASSWORD_LENGTH = 8; // matches backend PasswordPolicy.longueurMin default

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    prenom:          '',
    nom:             '',
    email:           '',
    password:        '',
    confirmPassword: '',
    role:            'DIRECTION_COMMERCIALE' as string,
  });
  const [showPwd,    setShowPwd]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const navigate = useNavigate();

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      return;
    }

    setLoading(true);
    try {
      const { prenom, nom, email, password, role } = formData;
      await api.post('/auth/register', { prenom, nom, email, password, role });
      navigate('/login');
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Une erreur est survenue lors de la création du compte'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Créer un compte"
      subtitle="Demandez votre accès à l'environnement professionnel ARS Tunisie"
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prénom / Nom */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#171f1a]">Prénom</label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93917f]" />
                <input
                  type="text"
                  value={formData.prenom}
                  onChange={set('prenom')}
                  className="h-12 w-full rounded-2xl border border-[#e8e2d2] bg-white pl-11 pr-4 text-sm text-[#171f1a] outline-none transition placeholder:text-[#93917f] focus:border-[#c5a15d] focus:ring-4 focus:ring-[#c5a15d]/20"
                  placeholder="Prénom"
                  autoComplete="given-name"
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#171f1a]">Nom</label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93917f]" />
                <input
                  type="text"
                  value={formData.nom}
                  onChange={set('nom')}
                  className="h-12 w-full rounded-2xl border border-[#e8e2d2] bg-white pl-11 pr-4 text-sm text-[#171f1a] outline-none transition placeholder:text-[#93917f] focus:border-[#c5a15d] focus:ring-4 focus:ring-[#c5a15d]/20"
                  placeholder="Nom"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[#171f1a]">Adresse e-mail</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93917f]" />
              <input
                type="email"
                value={formData.email}
                onChange={set('email')}
                className="h-12 w-full rounded-2xl border border-[#e8e2d2] bg-white pl-11 pr-4 text-sm text-[#171f1a] outline-none transition placeholder:text-[#93917f] focus:border-[#c5a15d] focus:ring-4 focus:ring-[#c5a15d]/20"
                placeholder="prenom.nom@arstunisie.com"
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[#171f1a]">Mot de passe</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#93917f]" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={formData.password}
                onChange={set('password')}
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
                value={formData.confirmPassword}
                onChange={set('confirmPassword')}
                className="h-12 w-full rounded-2xl border border-[#e8e2d2] bg-white pl-11 pr-12 text-sm text-[#171f1a] outline-none transition placeholder:text-[#93917f] focus:border-[#c5a15d] focus:ring-4 focus:ring-[#c5a15d]/20"
                placeholder="Répétez votre mot de passe"
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

          {/* Role */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[#171f1a]">Rôle</label>
            <select
              value={formData.role}
              onChange={set('role')}
              className="h-12 w-full rounded-2xl border border-[#e8e2d2] bg-white px-4 text-sm text-[#171f1a] outline-none transition focus:border-[#c5a15d] focus:ring-4 focus:ring-[#c5a15d]/20"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#c5a15d] to-[#b8914e] text-sm font-semibold text-[#0e1712] transition hover:from-[#b8914e] hover:to-[#a8813f] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 rounded-full border-2 border-[#0e1712]/30 border-t-[#0e1712] animate-spin" />
                <span>Création en cours…</span>
              </>
            ) : (
              <>
                <span>Créer un compte</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="rounded-2xl border border-[#c5a15d]/20 bg-[#c5a15d]/5 px-4 py-3 text-sm text-[#5b6358]">
          Vous avez déjà un compte ?{' '}
          <Link to="/login" className="font-semibold text-[#8f7038] transition hover:text-[#6b5529]">
            Se connecter
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}