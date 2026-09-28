/**
 * Single source of truth for roles. The API returns this catalog so the client
 * never hardcodes role names.
 *
 * NOTE: these are descriptions only. No permission checks are enforced against
 * them anywhere in the backend yet - authorisation is limited to tenant scoping.
 */
export const ROLES = Object.freeze([
  {
    key: "ADMIN",
    label: "Administrator",
    description: "Full access to this workspace, including its members and pipeline stages.",
  },
  {
    key: "SUBADMIN",
    label: "Sub administrator",
    description: "Manages day-to-day call activity. Elevated access is not yet enforced.",
  },
  {
    key: "AGENT",
    label: "Agent",
    description: "Works calls and moves records through the pipeline.",
  },
]);

export const ROLE_KEYS = Object.freeze(ROLES.map((role) => role.key));

/**
 * Roles allowed to change pipeline structure (create/edit/delete pipelines,
 * stages and tags). Reading is open to every member of the workspace.
 */
export const PIPELINE_MANAGER_ROLES = Object.freeze([ROLE_KEYS[0], ROLE_KEYS[1]]); // ADMIN, SUBADMIN

export default ROLES;
