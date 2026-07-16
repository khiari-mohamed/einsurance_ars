import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Domain types ────────────────────────────────────────────────────────────────

export type UserRole =
  | 'DIRECTION_COMMERCIALE'
  | 'DIRECTION_REASSURANCE'
  | 'DIRECTION_GENERALE'
  | 'DAF'
  | 'SERVICE_IRDS'
  | 'SUPER_ADMIN';

/**
 * Shape of the user object returned by the backend's /auth/login and /auth/me.
 * Uses French field names (nom / prenom) to match the Prisma schema exactly.
 */
export interface AuthUser {
  id: string;
  email: string;
  /** Nom de famille */
  nom: string;
  /** Prénom */
  prenom: string;
  role: UserRole;
  /** Module-level permission overrides: { "FINANCES": "READ_ONLY" | "NONE" } */
  modulePermissions: Record<string, string> | null;
}

// ── Permission enum ─────────────────────────────────────────────────────────────
// Mirrors the backend's Permission enum in src/config/permissions.config.ts

export type Permission =
  | 'affaires:create' | 'affaires:read' | 'affaires:update'
  | 'affaires:delete' | 'affaires:validate' | 'affaires:place'
  | 'sinistres:create' | 'sinistres:read' | 'sinistres:update'
  | 'sinistres:validate' | 'sinistres:close'
  | 'finances:read' | 'finances:create' | 'finances:update' | 'finances:approve'
  | 'comptabilite:read' | 'comptabilite:create'
  | 'comptabilite:validate' | 'comptabilite:export'
  | 'donnees:read' | 'donnees:create' | 'donnees:update' | 'donnees:delete'
  | 'ged:read' | 'ged:upload' | 'ged:delete'
  | 'system:read' | 'system:update' | 'users:manage'
  | 'reporting:read' | 'reporting:export';

// ── Role → permission map ───────────────────────────────────────────────────────
// Mirrors ROLE_PERMISSIONS from the backend. Keep in sync with server config.

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'affaires:create', 'affaires:read', 'affaires:update', 'affaires:delete',
    'affaires:validate', 'affaires:place',
    'sinistres:create', 'sinistres:read', 'sinistres:update',
    'sinistres:validate', 'sinistres:close',
    'finances:read', 'finances:create', 'finances:update', 'finances:approve',
    'comptabilite:read', 'comptabilite:create',
    'comptabilite:validate', 'comptabilite:export',
    'donnees:read', 'donnees:create', 'donnees:update', 'donnees:delete',
    'ged:read', 'ged:upload', 'ged:delete',
    'system:read', 'system:update', 'users:manage',
    'reporting:read', 'reporting:export',
  ],
  DIRECTION_REASSURANCE: [
    'affaires:create', 'affaires:read', 'affaires:update', 'affaires:delete',
    'affaires:validate', 'affaires:place',
    'sinistres:create', 'sinistres:read', 'sinistres:update',
    'sinistres:validate', 'sinistres:close',
    'donnees:read', 'donnees:create', 'donnees:update',
    'ged:read', 'ged:upload',
    'reporting:read',
  ],
  DIRECTION_COMMERCIALE: [
    'affaires:create', 'affaires:read',
    'donnees:read',
    'ged:read', 'ged:upload',
  ],
  DIRECTION_GENERALE: [
    'affaires:read', 'sinistres:read', 'finances:read', 'comptabilite:read',
    'donnees:read', 'ged:read',
    'reporting:read', 'reporting:export',
  ],
  DAF: [
    'finances:read', 'finances:create', 'finances:update', 'finances:approve',
    'comptabilite:read', 'comptabilite:create',
    'comptabilite:validate', 'comptabilite:export',
    'ged:read', 'ged:upload',
  ],
  SERVICE_IRDS: [
    'sinistres:read', 'sinistres:update', 'sinistres:close',
    'ged:read', 'ged:upload',
  ],
};

// ── Store interface ─────────────────────────────────────────────────────────────

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;

  // Mutations
  setAuth: (token: string, refreshToken: string, user: AuthUser) => void;
  updateAccessToken: (token: string) => void;
  logout: () => void;

  // Selectors
  isAuthenticated: () => boolean;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasRole: (roles: UserRole[]) => boolean;

  // Display helpers
  displayName: () => string;
  initials: () => string;
}

// ── Store ───────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,

      setAuth: (token, refreshToken, user) =>
        set({ token, refreshToken, user }),

      updateAccessToken: (token) => set({ token }),

      logout: () => set({ token: null, refreshToken: null, user: null }),

      isAuthenticated: () => !!get().token && !!get().user,

      hasPermission: (permission: Permission) => {
        const user = get().user;
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;

        const basePerms = ROLE_PERMISSIONS[user.role] ?? [];
        const overrides = user.modulePermissions ?? {};

        // Apply module-level overrides (e.g. { "FINANCES": "READ_ONLY" })
        const [module] = permission.split(':');
        const override = overrides[module.toUpperCase()];

        if (override === 'NONE') return false;
        if (override === 'READ_ONLY' && !permission.endsWith(':read'))
          return false;

        return basePerms.includes(permission);
      },

      hasAnyPermission: (permissions: Permission[]) =>
        permissions.some((p) => get().hasPermission(p)),

      hasAllPermissions: (permissions: Permission[]) =>
        permissions.every((p) => get().hasPermission(p)),

      hasRole: (roles: UserRole[]) => {
        const user = get().user;
        return !!user && roles.includes(user.role);
      },

      displayName: () => {
        const u = get().user;
        if (!u) return '';
        return `${u.prenom} ${u.nom}`.trim();
      },

      initials: () => {
        const u = get().user;
        if (!u) return '?';
        return `${u.prenom?.[0] ?? ''}${u.nom?.[0] ?? ''}`.toUpperCase();
      },
    }),
    {
      name: 'ars-auth',
      // Only persist raw data — never serialise functions
      partialize: (s) => ({
        token: s.token,
        refreshToken: s.refreshToken,
        user: s.user,
      }),
    },
  ),
);