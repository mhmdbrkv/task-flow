import type { ProjectRole } from './permissions';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
}

export interface ProjectMembership {
  project: Project;
  role: ProjectRole;
}

export interface Member {
  user: User;
  role: ProjectRole;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
  assignee: User | null;
  creator: User | null;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  author: User;
  createdAt: string;
}

export interface Invitation {
  id: string;
  projectId: string;
  inviteeId: string;
  role: 'MANAGER' | 'MEMBER';
  status: string;
  expiresAt: string;
  invitee: User;
  inviter: User;
  project: Project;
}

export interface AuthSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}
