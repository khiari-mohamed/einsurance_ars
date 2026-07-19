import type { UserRole, Permission } from '../lib/store';

// ── Route-level access map ──────────────────────────────────────────────────────
//
// Maps each route *prefix* to the roles allowed to visit it.
// The most specific matching prefix wins (longest-prefix-match).

const ROUTE_ACCESS: Record<string, UserRole[]> = {
  '/': [
    'DIRECTION_COMMERCIALE', 'DIRECTION_REASSURANCE',
    'DIRECTION_GENERALE', 'DAF', 'SERVICE_IRDS', 'SUPER_ADMIN',
  ],

  // ── Référentiel (master data) ────────────────────────────────────────────────
  '/assures': [
    'DIRECTION_COMMERCIALE', 'DIRECTION_REASSURANCE',
    'DIRECTION_GENERALE', 'DAF', 'SERVICE_IRDS', 'SUPER_ADMIN',
  ],
  '/cedantes': [
    'DIRECTION_COMMERCIALE', 'DIRECTION_REASSURANCE',
    'DIRECTION_GENERALE', 'DAF', 'SERVICE_IRDS', 'SUPER_ADMIN',
  ],
  '/reassureurs': [
    'DIRECTION_COMMERCIALE', 'DIRECTION_REASSURANCE',
    'DIRECTION_GENERALE', 'DAF', 'SERVICE_IRDS', 'SUPER_ADMIN',
  ],
  '/co-courtiers': [
    'DIRECTION_COMMERCIALE', 'DIRECTION_REASSURANCE',
    'DIRECTION_GENERALE', 'DAF', 'SERVICE_IRDS', 'SUPER_ADMIN',
  ],
  '/referentiel': [
    'DIRECTION_COMMERCIALE', 'DIRECTION_REASSURANCE',
    'DIRECTION_GENERALE', 'DAF', 'SERVICE_IRDS', 'SUPER_ADMIN',
  ],

  // ── Affaires ─────────────────────────────────────────────────────────────────
  '/affaires': [
    'DIRECTION_COMMERCIALE', 'DIRECTION_REASSURANCE',
    'DIRECTION_GENERALE', 'SUPER_ADMIN',
  ],
  '/facultatives': [
    'DIRECTION_COMMERCIALE', 'DIRECTION_REASSURANCE',
    'DIRECTION_GENERALE', 'SUPER_ADMIN',
  ],
  '/traites': [
    'DIRECTION_COMMERCIALE', 'DIRECTION_REASSURANCE',
    'DIRECTION_GENERALE', 'SUPER_ADMIN',
  ],

  // ── Bordereaux ────────────────────────────────────────────────────────────────
  '/bordereaux': [
    'DIRECTION_REASSURANCE', 'DIRECTION_GENERALE', 'DAF', 'SUPER_ADMIN',
  ],

  // ── Sinistres ────────────────────────────────────────────────────────────────
  '/sinistres': [
    'DIRECTION_REASSURANCE', 'DIRECTION_GENERALE',
    'SERVICE_IRDS', 'SUPER_ADMIN',
  ],

  // ── Finances ─────────────────────────────────────────────────────────────────
  '/finances': ['DAF', 'DIRECTION_GENERALE', 'SUPER_ADMIN'],

  // ── Comptabilité ─────────────────────────────────────────────────────────────
  '/comptabilite': ['DAF', 'SUPER_ADMIN'],

  // ── Reporting ────────────────────────────────────────────────────────────────
  '/reporting': [
    'DIRECTION_GENERALE', 'DIRECTION_REASSURANCE', 'DAF', 'SUPER_ADMIN',
  ],

  // ── GED ──────────────────────────────────────────────────────────────────────
  '/documents': [
    'DIRECTION_COMMERCIALE', 'DIRECTION_REASSURANCE',
    'DIRECTION_GENERALE', 'DAF', 'SERVICE_IRDS', 'SUPER_ADMIN',
  ],

  // ── Workflow ─────────────────────────────────────────────────────────────────
  '/workflow': [
    'DIRECTION_REASSURANCE', 'DAF', 'SERVICE_IRDS', 'SUPER_ADMIN',
  ],

  // ── Administration — SUPER_ADMIN only ────────────────────────────────────────
  '/admin': ['SUPER_ADMIN'],
};

/**
 * Returns true when a user with the given role may access `path`.
 * Falls back to `true` for paths not in the map (allow all authenticated users).
 */
export function canAccessRoute(role: string, path: string): boolean {
  // Strip query-string and hash fragment
  const cleanPath = path.split('?')[0].split('#')[0];

  // Longest-prefix-match
  const matchedPrefix = Object.keys(ROUTE_ACCESS)
    .filter(
      (prefix) =>
        cleanPath === prefix || cleanPath.startsWith(prefix + '/'),
    )
    .sort((a, b) => b.length - a.length)[0];

  if (!matchedPrefix) return true; // not in map → allow all authenticated users

  return (ROUTE_ACCESS[matchedPrefix] as string[]).includes(role);
}

// ── Permission-based route guard (for fine-grained component guards) ────────────

const ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/assures':      ['donnees:read'],
  '/cedantes':     ['donnees:read'],
  '/reassureurs':  ['donnees:read'],
  '/co-courtiers': ['donnees:read'],
  '/affaires':     ['affaires:read'],
  '/bordereaux':   ['affaires:read'],
  '/sinistres':    ['sinistres:read'],
  '/finances':     ['finances:read'],
  '/comptabilite': ['comptabilite:read'],
  '/reporting':    ['reporting:read'],
  '/documents':    ['ged:read'],
  '/workflow':     ['affaires:read'],
  '/admin':        ['users:manage'],
};

/** Returns the Permission[] required to access a given route prefix. */
export function routeRequiredPermissions(path: string): Permission[] {
  const cleanPath = path.split('?')[0].split('#')[0];
  const prefix = Object.keys(ROUTE_PERMISSIONS)
    .filter(
      (p) => cleanPath === p || cleanPath.startsWith(p + '/'),
    )
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? ROUTE_PERMISSIONS[prefix] : [];
}
