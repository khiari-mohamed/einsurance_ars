import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../lib/store';
import { canAccessRoute } from '../config/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoute: string;
}

export default function ProtectedRoute({ children, requiredRoute }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !canAccessRoute(user.role, requiredRoute)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">403</h1>
          <p className="text-gray-600 mb-4">Accès refusé</p>
          <p className="text-sm text-gray-500">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
          <button
            onClick={() => window.history.back()}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
