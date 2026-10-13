export const OWNER_ROLE = 'owner';
const ROLE_SEPARATOR = ',';

export function isOwnerRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role
    .split(ROLE_SEPARATOR)
    .map((name) => name.trim())
    .includes(OWNER_ROLE);
}
