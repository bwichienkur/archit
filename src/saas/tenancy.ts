export type TenantRole = 'owner'|'admin'|'architect'|'builder'|'designer'|'customer'|'viewer';
export type ProjectPermission = 'project:read'|'project:edit'|'cad:import'|'bim:edit'|'catalog:manage'|'pricing:manage'|'selection:approve'|'comment:create'|'export:create'|'admin:manage';

const rolePermissions: Record<TenantRole, ReadonlySet<ProjectPermission>> = {
  owner:new Set(['project:read','project:edit','cad:import','bim:edit','catalog:manage','pricing:manage','selection:approve','comment:create','export:create','admin:manage']),
  admin:new Set(['project:read','project:edit','cad:import','bim:edit','catalog:manage','pricing:manage','selection:approve','comment:create','export:create','admin:manage']),
  architect:new Set(['project:read','project:edit','cad:import','bim:edit','comment:create','export:create']),
  builder:new Set(['project:read','project:edit','bim:edit','catalog:manage','pricing:manage','selection:approve','comment:create','export:create']),
  designer:new Set(['project:read','project:edit','bim:edit','comment:create','export:create']),
  customer:new Set(['project:read','selection:approve','comment:create']),
  viewer:new Set(['project:read']),
};

export type TenantMembership = { tenantId:string; userId:string; role:TenantRole; projectIds?:string[] };

export function can(membership:TenantMembership, permission:ProjectPermission, projectId?:string) {
  if (!rolePermissions[membership.role].has(permission)) return false;
  if (!projectId || !membership.projectIds || membership.projectIds.length===0) return true;
  return membership.projectIds.includes(projectId);
}

export function assertPermission(membership:TenantMembership, permission:ProjectPermission, projectId?:string) {
  if (!can(membership,permission,projectId)) throw new Error(`Role ${membership.role} does not have ${permission}${projectId?` on project ${projectId}`:''}.`);
}
