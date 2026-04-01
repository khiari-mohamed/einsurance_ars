import type { ReactNode } from 'react';
import { Shield, Lock, Headphones } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      <div className="hidden lg:flex lg:w-[48%] xl:w-[45%] relative overflow-hidden">
        <img
          src="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1200"
          alt="Modern corporate building"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-red-900/80" />

        <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <img src="/Image1.png" alt="ARS Tunisie" className="h-10 w-auto brightness-0 invert" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">ARS Tunisie</h1>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-red-200/80">
                Plateforme de Réassurance
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center max-w-md py-12">
            <h2 className="mb-4 text-3xl font-bold leading-tight text-white xl:text-4xl">
              Votre portail de
              <br />
              <span className="bg-gradient-to-r from-red-400 via-red-200 to-white bg-clip-text text-transparent">
                réassurance intelligent
              </span>
            </h2>
            <p className="mb-10 text-base leading-relaxed text-slate-300">
              Gérez vos opérations, vos accès et vos workflows dans une interface claire, premium et conçue
              pour les usages professionnels d’ARS Tunisie.
            </p>

            <div className="space-y-4">
              <FeatureItem
                icon={<Shield className="h-5 w-5" />}
                title="Protection des données"
                description="Accès sécurisés, gestion des rôles et confidentialité renforcée."
              />
              <FeatureItem
                icon={<Lock className="h-5 w-5" />}
                title="Sécurité renforcée"
                description="Authentification fiable et maîtrise des accès sensibles."
              />
              <FeatureItem
                icon={<Headphones className="h-5 w-5" />}
                title="Support dédié"
                description="Une plateforme pensée pour accompagner les équipes métier au quotidien."
              />
            </div>
          </div>

          <p className="text-xs text-slate-400">© {new Date().getFullYear()} ARS Tunisie. Tous droits réservés.</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-slate-50 via-white to-red-50/40 p-4 sm:p-6 md:p-8 lg:p-12">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 text-center lg:hidden">
            <img src="/Image1.png" alt="ARS Tunisie" className="mx-auto mb-3 h-11 w-auto" />
            <h1 className="text-xl font-bold text-slate-900">ARS Tunisie</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Plateforme de Réassurance</p>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="group flex items-start gap-3.5">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-red-300 backdrop-blur-sm transition-colors group-hover:bg-white/15">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
    </div>
  );
}
