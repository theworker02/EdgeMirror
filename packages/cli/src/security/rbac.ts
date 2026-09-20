/**
 * RBAC + cross-tenant isolation primitives for future control-plane.
 * Fail closed: missing tenant or role → deny.
 */

export type Role = "owner" | "admin" | "member" | "viewer" | "runner" | "billing";

export type Permission =
  | "org:read"
  | "org:write"
  | "project:read"
  | "project:write"
  | "run:create"
  | "run:read"
  | "runner:register"
  | "billing:read"
  | "billing:write"
  | "webhook:manage";

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set([
    "org:read",
    "org:write",
    "project:read",
    "project:write",
    "run:create",
    "run:read",
    "runner:register",
    "billing:read",
    "billing:write",
    "webhook:manage",
  ]),
  admin: new Set([
    "org:read",
    "org:write",
    "project:read",
    "project:write",
    "run:create",
    "run:read",
    "runner:register",
    "billing:read",
    "webhook:manage",
  ]),
  member: new Set([
    "org:read",
    "project:read",
    "project:write",
    "run:create",
    "run:read",
  ]),
  viewer: new Set(["org:read", "project:read", "run:read"]),
  runner: new Set(["run:create", "run:read", "runner:register"]),
  billing: new Set(["billing:read", "billing:write", "org:read"]),
};

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface Principal {
  userId: string;
  orgId: string;
  roles: Role[];
}

export interface ResourceRef {
  orgId: string;
  projectId?: string;
}

export function permissionsFor(roles: Role[]): Set<Permission> {
  const out = new Set<Permission>();
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role];
    if (perms) for (const p of perms) out.add(p);
  }
  return out;
}

export function hasPermission(principal: Principal, permission: Permission): boolean {
  if (!principal.userId || !principal.orgId || !principal.roles?.length) {
    return false;
  }
  return permissionsFor(principal.roles).has(permission);
}

export function assertPermission(
  principal: Principal,
  permission: Permission,
): void {
  if (!hasPermission(principal, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
}

/**
 * Cross-tenant guard — resource.orgId must match principal.orgId.
 */
export function assertSameTenant(
  principal: Principal,
  resource: ResourceRef,
): void {
  if (!principal.orgId || !resource.orgId) {
    throw new AuthorizationError("Tenant context required");
  }
  if (principal.orgId !== resource.orgId) {
    throw new AuthorizationError("Cross-tenant access denied");
  }
}

export function authorize(
  principal: Principal,
  permission: Permission,
  resource: ResourceRef,
): void {
  assertSameTenant(principal, resource);
  assertPermission(principal, permission);
}
