export const permissions = {
  admin: ['*'],
  direction: ['view_all', 'edit_all', 'approve'],
  commercial: ['view_affaires', 'create_affaires', 'edit_affaires'],
  technique: ['view_affaires', 'view_traites', 'edit_affaires'],
  finance: ['view_finances', 'create_payment', 'view_bordereaux'],
  comptabilite: ['view_accounting', 'create_entries'],
  viewer: ['view_only'],
};

export const hasPermission = (userRole: string, permission: string): boolean => {
  const rolePermissions = permissions[userRole as keyof typeof permissions] || [];
  return rolePermissions.includes('*') || rolePermissions.includes(permission);
};
