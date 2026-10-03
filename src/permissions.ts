export type ProjectRole = 'OWNER' | 'MANAGER' | 'MEMBER';

export type ProjectCapability =
  | 'PROJECT_UPDATE'
  | 'PROJECT_DELETE'
  | 'PROJECT_TRANSFER_OWNERSHIP'
  | 'PROJECT_MANAGE_MANAGERS'
  | 'PROJECT_LEAVE'
  | 'MEMBER_INVITE'
  | 'MEMBER_MANAGE'
  | 'INVITATION_MANAGE'
  | 'TASK_CREATE'
  | 'TASK_UPDATE'
  | 'TASK_DELETE'
  | 'TASK_ASSIGN'
  | 'TASK_UPDATE_STATUS'
  | 'TASK_UPDATE_PRIORITY'
  | 'COMMENT_CREATE'
  | 'COMMENT_UPDATE_OWN'
  | 'COMMENT_DELETE_OWN'
  | 'COMMENT_DELETE_ANY';

const roleCapabilities: Record<ProjectRole, ReadonlySet<ProjectCapability>> = {
  OWNER: new Set([
    'PROJECT_UPDATE',
    'PROJECT_DELETE',
    'PROJECT_TRANSFER_OWNERSHIP',
    'PROJECT_MANAGE_MANAGERS',
    'MEMBER_INVITE',
    'MEMBER_MANAGE',
    'INVITATION_MANAGE',
    'TASK_CREATE',
    'TASK_UPDATE',
    'TASK_DELETE',
    'TASK_ASSIGN',
    'TASK_UPDATE_STATUS',
    'TASK_UPDATE_PRIORITY',
    'COMMENT_CREATE',
    'COMMENT_UPDATE_OWN',
    'COMMENT_DELETE_OWN',
    'COMMENT_DELETE_ANY',
  ]),
  MANAGER: new Set([
    'PROJECT_LEAVE',
    'TASK_CREATE',
    'TASK_UPDATE',
    'TASK_DELETE',
    'TASK_ASSIGN',
    'TASK_UPDATE_STATUS',
    'TASK_UPDATE_PRIORITY',
    'COMMENT_CREATE',
    'COMMENT_UPDATE_OWN',
    'COMMENT_DELETE_OWN',
    'COMMENT_DELETE_ANY',
  ]),
  MEMBER: new Set([
    'PROJECT_LEAVE',
    'TASK_UPDATE_STATUS',
    'COMMENT_CREATE',
    'COMMENT_UPDATE_OWN',
    'COMMENT_DELETE_OWN',
  ]),
};

export function can(
  role: ProjectRole | null | undefined,
  capability: ProjectCapability,
): boolean {
  return role ? roleCapabilities[role].has(capability) : false;
}

export function canChangeTaskStatus(
  role: ProjectRole | null | undefined,
  assigneeId: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!can(role, 'TASK_UPDATE_STATUS')) return false;
  if (role !== 'MEMBER') return true;
  return Boolean(userId && assigneeId === userId);
}

export function canAssignTo(
  role: ProjectRole | null | undefined,
  targetRole: ProjectRole,
): boolean {
  if (!can(role, 'TASK_ASSIGN')) return false;
  return role !== 'MANAGER' || targetRole === 'MEMBER';
}
