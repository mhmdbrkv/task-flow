import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import LandingPage from './LandingPage';
import BrandMark from './BrandMark';
import { api, decodeUserId, getAccessToken, setAccessToken, ApiError } from './api';
import {
  can,
  canAssignTo,
  canChangeTaskStatus,
  type ProjectRole,
} from './permissions';
import type {
  Comment,
  AuthSession,
  Invitation,
  Member,
  ProjectMembership,
  Task,
  TaskPriority,
  TaskStatus,
} from './types';

type Page = 'overview' | 'tasks' | 'members' | 'invitations' | 'inbox' | 'sessions';
const pages: Page[] = ['overview', 'tasks', 'members', 'invitations', 'inbox', 'sessions'];

function locationPage(): Page {
  const requestedPage = new URLSearchParams(window.location.search).get('page');
  return pages.includes(requestedPage as Page) ? requestedPage as Page : 'overview';
}

const statusLabels: Record<TaskStatus, string> = {
  TODO: 'لسه ما بدأتش',
  IN_PROGRESS: 'شغالة',
  DONE: 'خلصت',
  CANCELLED: 'اتلغت',
};

const priorityLabels: Record<TaskPriority, string> = {
  CRITICAL: 'عاجلة',
  HIGH: 'عالية',
  MEDIUM: 'متوسطة',
  LOW: 'منخفضة',
};

const pageLabels: Record<Page, string> = {
  overview: 'نظرة عامة',
  tasks: 'المهام',
  members: 'الأعضاء',
  invitations: 'الدعوات',
  inbox: 'دعواتك',
  sessions: 'الجلسات',
};

const roleLabels: Record<ProjectRole, string> = {
  OWNER: 'مالك المشروع',
  MANAGER: 'مدير',
  MEMBER: 'عضو',
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function dateLabel(date: string | null) {
  if (!date) return 'من غير ميعاد تسليم';
  return new Intl.DateTimeFormat('ar-EG', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'حصلت مشكلة. جرّب تاني.';
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [showAuth, setShowAuth] = useState(() => new URLSearchParams(window.location.search).has('auth'));
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>(() =>
    new URLSearchParams(window.location.search).get('auth') === 'register' ? 'register' : 'login',
  );
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [projects, setProjects] = useState<ProjectMembership[]>([]);
  const [activeProjectId, setActiveProjectId] = useState(() =>
    new URLSearchParams(window.location.search).get('project') ?? '',
  );
  const [page, setPage] = useState<Page>(locationPage);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([]);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [projectLoading, setProjectLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '' });
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [commentsByTask, setCommentsByTask] = useState<Record<string, Comment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [inviteForm, setInviteForm] = useState({ inviteeId: '', role: 'MEMBER' });
  const [ownershipTarget, setOwnershipTarget] = useState('');

  const activeMembership = projects.find(
    (membership) => membership.project.id === activeProjectId,
  );
  const project = activeMembership?.project;
  const role = activeMembership?.role;
  const displayName = userEmail.split('@')[0] || 'أهلًا';

  const navigateTo = useCallback((nextPage: Page, nextProjectId = activeProjectId) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('auth');
    url.searchParams.set('page', nextPage);
    if (nextProjectId) url.searchParams.set('project', nextProjectId);
    else url.searchParams.delete('project');
    window.history.pushState({}, '', url);
    setPage(nextPage);
    setActiveProjectId(nextProjectId);
  }, [activeProjectId]);

  const navigateToAuth = useCallback((mode: 'login' | 'register' | null) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    url.searchParams.delete('project');
    if (mode) url.searchParams.set('auth', mode);
    else url.searchParams.delete('auth');
    window.history.pushState({}, '', url);
    setAuthMode(mode ?? 'login');
    setShowAuth(mode !== null);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    if (userId) {
      url.searchParams.delete('auth');
      url.searchParams.set('page', page);
      if (activeProjectId) url.searchParams.set('project', activeProjectId);
      else url.searchParams.delete('project');
    } else if (showAuth) {
      url.searchParams.delete('page');
      url.searchParams.delete('project');
      url.searchParams.set('auth', authMode);
    } else {
      url.searchParams.delete('page');
      url.searchParams.delete('project');
      url.searchParams.delete('auth');
    }
    window.history.replaceState(window.history.state, '', url);
  }, [activeProjectId, authMode, page, ready, showAuth, userId]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (userId) {
        const requestedProject = params.get('project');
        if (requestedProject && projects.some((item) => item.project.id === requestedProject)) {
          setActiveProjectId(requestedProject);
        } else if (!requestedProject) {
          setActiveProjectId(projects[0]?.project.id ?? '');
        }
        const requestedPage = params.get('page');
        setPage(pages.includes(requestedPage as Page) ? requestedPage as Page : 'overview');
      } else {
        const requestedAuth = params.get('auth');
        setAuthMode(requestedAuth === 'register' ? 'register' : 'login');
        setShowAuth(requestedAuth === 'login' || requestedAuth === 'register');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [projects, userId]);

  useEffect(() => {
    document.documentElement.lang = 'ar-EG';
    document.documentElement.dir = 'rtl';
  }, []);

  const projectStats = useMemo(() => {
    const done = tasks.filter((task) => task.status === 'DONE').length;
    const inProgress = tasks.filter((task) => task.status === 'IN_PROGRESS').length;
    return [
      { label: 'مهام مفتوحة', value: tasks.length - done, note: 'في المشروع ده' },
      { label: 'شغالة', value: inProgress, note: 'بتتقدم' },
      { label: 'خلصت', value: done, note: 'عاش يا فريق' },
      { label: 'أعضاء', value: members.length, note: 'في المشروع ده' },
    ];
  }, [members.length, tasks]);

  const loadProjects = useCallback(async (nextUserId: string) => {
    const nextProjects = await api<ProjectMembership[]>('/projects');
    setProjects(nextProjects);
    setActiveProjectId((current) =>
      nextProjects.some((item) => item.project.id === current)
        ? current
        : (nextProjects[0]?.project.id ?? ''),
    );
    setUserId(nextUserId);
    return nextProjects;
  }, []);

  const refreshProject = useCallback(async () => {
    if (!userId) return false;
    try {
      const nextProjects = await loadProjects(userId);
      const selected =
        nextProjects.find((item) => item.project.id === activeProjectId) ??
        nextProjects[0];
      const selectedId = selected?.project.id ?? '';
      setActiveProjectId(selectedId);
      if (!selected) {
        setTasks([]);
        setMembers([]);
        setInvitations([]);
        return true;
      }
      const [nextTasks, nextMembers] = await Promise.all([
        api<Task[]>(`/projects/${selectedId}/tasks`),
        api<Member[]>(`/projects/${selectedId}/members`),
      ]);
      setTasks(nextTasks);
      setMembers(nextMembers);
      const currentMember = nextMembers.find((member) => member.user.id === userId);
      if (currentMember) setUserEmail(currentMember.user.email);
      setOwnershipTarget(
        nextMembers.find((member) => member.role !== 'OWNER')?.user.id ?? '',
      );
      if (page === 'invitations' && can(selected.role, 'INVITATION_MANAGE')) {
        setInvitations(await api<Invitation[]>(`/projects/${selectedId}/invitations`));
      } else {
        setInvitations([]);
      }
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    }
  }, [activeProjectId, loadProjects, page, userId]);

  useEffect(() => {
    const handleForbidden = () => {
      void refreshProject();
    };
    const handleUnauthorized = () => {
      setAccessToken(null);
      setUserId(null);
      setProjects([]);
      setActiveProjectId('');
      setAuthError('جلستك خلصت. سجّل دخولك تاني من فضلك.');
      setShowAuth(true);
    };
    window.addEventListener('taskflow:forbidden', handleForbidden);
    window.addEventListener('taskflow:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('taskflow:forbidden', handleForbidden);
      window.removeEventListener('taskflow:unauthorized', handleUnauthorized);
    };
  }, [refreshProject]);

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      const existingToken = getAccessToken();
      let existingUserId = existingToken ? decodeUserId(existingToken) : null;
      try {
        const list = await api<ProjectMembership[]>('/projects');
        try {
          const received = await api<Invitation[]>('/invitations');
          if (mounted) setReceivedInvitations(received);
        } catch (cause) {
          if (mounted) setError(errorMessage(cause));
        }
        if (!existingUserId) {
          const refreshedToken = getAccessToken();
          existingUserId = refreshedToken ? decodeUserId(refreshedToken) : null;
        }
        if (mounted && existingUserId) {
          setUserId(existingUserId);
          setProjects(list);
          const requestedProject = new URLSearchParams(window.location.search).get('project');
          setActiveProjectId(
            list.find((item) => item.project.id === requestedProject)?.project.id ??
              list[0]?.project.id ??
              '',
          );
          setReady(true);
        } else if (mounted) {
          setReady(true);
        }
      } catch (cause) {
        if (!mounted) return;
        if (cause instanceof ApiError && cause.status === 401) {
          setAccessToken(null);
        } else {
          setAuthError(errorMessage(cause));
        }
        setReady(true);
      }
    }
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (page === 'invitations' && !can(role, 'INVITATION_MANAGE')) {
      setPage('overview');
    }
  }, [page, role]);

  useEffect(() => {
    if (!userId || page !== 'inbox') return;
    let mounted = true;
    api<Invitation[]>('/invitations')
      .then((items) => {
        if (mounted) setReceivedInvitations(items);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(errorMessage(cause));
      });
    return () => {
      mounted = false;
    };
  }, [navigateTo, page, userId]);

  useEffect(() => {
    if (!userId || page !== 'sessions') return;
    let mounted = true;
    api<AuthSession[]>('/auth/sessions')
      .then((items) => {
        if (mounted) setSessions(items);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(errorMessage(cause));
      });
    return () => {
      mounted = false;
    };
  }, [page, userId]);

  useEffect(() => {
    if (page === 'inbox') {
      setProjectLoading(false);
      return;
    }
    if (!userId || !activeMembership) {
      setTasks([]);
      setMembers([]);
      setInvitations([]);
      return;
    }
    let mounted = true;
    async function loadProjectData() {
      setProjectLoading(true);
      setError('');
      try {
        const [nextTasks, nextMembers] = await Promise.all([
          api<Task[]>(`/projects/${activeMembership!.project.id}/tasks`),
          api<Member[]>(`/projects/${activeMembership!.project.id}/members`),
        ]);
        if (mounted) {
          setTasks(nextTasks);
          setMembers(nextMembers);
          const currentMember = nextMembers.find((member) => member.user.id === userId);
          if (currentMember) setUserEmail(currentMember.user.email);
          setOwnershipTarget(
            nextMembers.find((member) => member.role !== 'OWNER')?.user.id ?? '',
          );
        }
        if (page === 'invitations' && can(activeMembership!.role, 'INVITATION_MANAGE')) {
          const nextInvitations = await api<Invitation[]>(
            `/projects/${activeMembership!.project.id}/invitations`,
          );
          if (mounted) setInvitations(nextInvitations);
        } else if (mounted) {
          setInvitations([]);
        }
      } catch (cause) {
        if (mounted) setError(errorMessage(cause));
      } finally {
        if (mounted) setProjectLoading(false);
      }
    }
    void loadProjectData();
    return () => {
      mounted = false;
    };
  }, [activeMembership?.project.id, activeMembership?.role, page, userId]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      const route = authMode === 'login' ? '/auth/login' : '/auth/register';
      const body =
        authMode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : { ...authForm, role: 'USER' };
      const result = await api<{ accessToken: string }>(route, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAccessToken(result.accessToken);
      const nextUserId = decodeUserId(result.accessToken);
      if (!nextUserId) throw new Error('بيانات الدخول اللي وصلتنا مش كاملة. جرّب تاني.');
      setUserEmail(authForm.email);
      setAuthError('');
      setShowAuth(false);
      await loadProjects(nextUserId);
      try {
        setReceivedInvitations(await api<Invitation[]>('/invitations'));
      } catch (cause) {
        setError(errorMessage(cause));
      }
    } catch (cause) {
      setAuthError(errorMessage(cause));
    } finally {
      setAuthBusy(false);
      setReady(true);
    }
  }

  async function signOut() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.status === 401)) setNotice(errorMessage(cause));
    }
    setAccessToken(null);
    navigateToAuth(null);
    setUserId(null);
    setProjects([]);
    setReceivedInvitations([]);
    setSessions([]);
    setActiveProjectId('');
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const description = projectForm.description.trim();
      const created = await api<{ project: { id: string } }>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: projectForm.name.trim(),
          ...(description ? { description } : {}),
        }),
      });
      const nextProjects = await api<ProjectMembership[]>('/projects');
      setProjects(nextProjects);
      navigateTo('overview', created.project.id);
      setCreateProjectOpen(false);
      setProjectForm({ name: '', description: '' });
      setNotice('مشروعك الجديد جاهز.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function updateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    setSaving(true);
    setError('');
    try {
      const description = projectForm.description.trim();
      await api(`/projects/${project.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: projectForm.name.trim(),
          description: description || null,
        }),
      });
      setSettingsOpen(false);
      if (!(await refreshProject())) return;
      setNotice('تفاصيل المشروع اتحفظت.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    setSaving(true);
    setError('');
    try {
      await api(`/projects/${project.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || undefined,
          dueDate: taskForm.dueDate || undefined,
        }),
      });
      setTaskForm({ title: '', description: '', dueDate: '' });
      setCreateTaskOpen(false);
      if (!(await refreshProject())) return;
      setNotice('المهمة اتعملت.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(
    task: Task,
    endpoint: 'status' | 'priority' | 'assign' | 'unassign' | 'edit',
    value: string,
  ) {
    if (!project) return;
    setError('');
    try {
      const method = endpoint === 'edit' ? 'PATCH' : endpoint === 'status' || endpoint === 'priority' ? 'PATCH' : 'POST';
      const path =
        endpoint === 'edit'
          ? `/tasks/${task.id}`
          : endpoint === 'unassign'
            ? `/tasks/${task.id}/unassign`
            : `/tasks/${task.id}/${endpoint}`;
      const body =
        endpoint === 'status'
          ? { status: value }
          : endpoint === 'priority'
            ? { priority: value }
            : endpoint === 'assign'
              ? { assigneeId: value }
              : endpoint === 'unassign'
                ? { assigneeId: task.assigneeId }
                : JSON.parse(value);
      await api(path, { method, body: JSON.stringify(body) });
      if (!(await refreshProject())) return;
      setNotice('المهمة اتحدّثت.');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function loadComments(taskId: string) {
    if (expandedTask === taskId) {
      setExpandedTask(null);
      return;
    }
    setExpandedTask(taskId);
    if (commentsByTask[taskId]) return;
    try {
      const comments = await api<Comment[]>(`/tasks/${taskId}/comments`);
      setCommentsByTask((current) => ({ ...current, [taskId]: comments }));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function postComment(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();
    const content = commentDrafts[taskId]?.trim();
    if (!content) return;
    try {
      await api<Comment>(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      const updatedComments = await api<Comment[]>(`/tasks/${taskId}/comments`);
      setCommentsByTask((current) => ({ ...current, [taskId]: updatedComments }));
      setCommentDrafts((current) => ({ ...current, [taskId]: '' }));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function saveComment(commentId: string, taskId: string) {
    try {
      await api(`/comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editingCommentText }),
      });
      setCommentsByTask((current) => ({
        ...current,
        [taskId]: current[taskId].map((comment) =>
          comment.id === commentId ? { ...comment, content: editingCommentText } : comment,
        ),
      }));
      setEditingComment(null);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function deleteComment(commentId: string, taskId: string) {
    try {
      await api(`/comments/${commentId}`, { method: 'DELETE' });
      setCommentsByTask((current) => ({
        ...current,
        [taskId]: current[taskId].filter((comment) => comment.id !== commentId),
      }));
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    setSaving(true);
    setError('');
    try {
      await api(`/projects/${project.id}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          inviteeId: inviteForm.inviteeId.trim(),
          role: inviteForm.role,
        }),
      });
      setInviteForm({ inviteeId: '', role: 'MEMBER' });
      if (!(await refreshProject())) return;
      setNotice('الدعوة اتبعتت.');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function cancelInvitation(invitationId: string) {
    try {
      await api(`/invitations/${invitationId}`, { method: 'DELETE' });
      setInvitations((current) => current.filter((item) => item.id !== invitationId));
      setNotice('الدعوة اتلغت.');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function respondToInvitation(invitation: Invitation, decision: 'accept' | 'reject') {
    try {
      await api(`/invitations/${invitation.id}/${decision}`, { method: 'POST' });
      setReceivedInvitations((current) =>
        current.filter((item) => item.id !== invitation.id),
      );
      if (decision === 'accept' && userId) {
        await loadProjects(userId);
        navigateTo('overview', invitation.projectId);
        setNotice(`انضميت لمشروع ${invitation.project.name}.`);
      } else {
        setNotice('اعتذرت عن الدعوة.');
      }
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function revokeSession(session: AuthSession) {
    if (session.current) return;
    try {
      await api(`/auth/sessions/${session.id}`, { method: 'DELETE' });
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setNotice('الجلسة اتلغت.');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function signOutEverywhere() {
    try {
      await api('/auth/logout-all', { method: 'POST' });
      setAccessToken(null);
      navigateToAuth(null);
      setUserId(null);
      setProjects([]);
      setReceivedInvitations([]);
      setSessions([]);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function deleteTask(task: Task) {
    try {
      await api(`/tasks/${task.id}`, { method: 'DELETE' });
      if (!(await refreshProject())) return;
      setNotice('المهمة اتمسحت.');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function deleteProject() {
    if (!project || !userId) return;
    try {
      await api(`/projects/${project.id}`, { method: 'DELETE' });
      const remaining = await loadProjects(userId);
      navigateTo('overview', remaining[0]?.project.id ?? '');
      setSettingsOpen(false);
      setNotice('المشروع اتمسح.');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function updateMember(member: Member, action: 'promote' | 'demote') {
    if (!project) return;
    try {
      await api(`/projects/${project.id}/members/${member.user.id}/${action}`, {
        method: 'POST',
      });
      const nextMembers = await api<Member[]>(`/projects/${project.id}/members`);
      setMembers(nextMembers);
      setNotice(action === 'promote' ? `${member.user.name} بقى مدير في المشروع.` : `${member.user.name} بقى عضو في المشروع.`);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function removeMember(member: Member) {
    if (!project) return;
    try {
      await api(`/projects/${project.id}/members/${member.user.id}`, {
        method: 'DELETE',
      });
      if (!(await refreshProject())) return;
      setNotice(`${member.user.name} اتشال من المشروع.`);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function leaveProject() {
    if (!project || !userId) return;
    try {
      await api(`/projects/${project.id}/leave`, { method: 'POST' });
      const remaining = await loadProjects(userId);
      navigateTo('overview', remaining[0]?.project.id ?? '');
      setNotice(`سيبت مشروع ${project.name}.`);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  async function transferOwnership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !ownershipTarget) return;
    try {
      await api(`/projects/${project.id}/transfer-ownership`, {
        method: 'POST',
        body: JSON.stringify({ newOwnerId: ownershipTarget }),
      });
      if (!(await refreshProject())) return;
      setNotice('ملكية المشروع اتنقلت.');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  if (!ready) {
    return <main className="loading-screen" dir="rtl"><BrandMark /><p>بنجهّز مساحة شغلك…</p></main>;
  }

  if (!userId) {
    if (!showAuth) {
      return <LandingPage onSignIn={() => { setAuthError(''); navigateToAuth('login'); }} onRegister={() => { setAuthError(''); navigateToAuth('register'); }} />;
    }
    return (
      <main className="auth-layout" dir="rtl">
        <section className="auth-story">
          <a className="brand" href="#" onClick={(event) => { event.preventDefault(); navigateToAuth(null); }}><BrandMark /><span className="brand-word">تاسك فلو</span></a>
          <div className="auth-story-copy">
            <span className="eyebrow">شغلكم كله في مكان واحد</span>
            <h1>خلّي الشغل يمشي بسلاسة.</h1>
            <p>رتّبوا مشاريعكم ومهامكم وخلي كل واحد عارف دوره — من غير دوشة.</p>
          </div>
          <div className="story-note"><span>✳</span><p>الشغل الحلو بيبدأ<br />لما كل واحد يبقى عارف<br />مسؤوليته.</p></div>
          <span className="auth-footer">فريق متفاهم، وخطوة ورا خطوة.</span>
        </section>
        <section className="auth-panel">
          <div className="auth-card">
            <span className="eyebrow">{authMode === 'login' ? 'منور تاني' : 'يلا نبدأ'}</span>
            <h2>{authMode === 'login' ? 'ادخل على تاسك فلو' : 'اعمل حساب جديد'}</h2>
            <p className="muted">يوم شغل أحسن لفريقك بيبدأ من هنا.</p>
            {authError && <div className="alert alert-error" role="alert">{authError}</div>}
            <form className="stack-form" onSubmit={handleAuth}>
              {authMode === 'register' && (
                <label>اسمك<input autoComplete="name" minLength={2} required value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} placeholder="محمد أحمد" /></label>
              )}
              <label>الإيميل<input type="email" autoComplete="email" required value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="you@company.com" /></label>
              <label>كلمة السر<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={8} required value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="٨ حروف أو أكتر" /></label>
              <button className="button button-primary button-wide" disabled={authBusy}>{authBusy ? 'ثواني بس…' : authMode === 'login' ? 'دخول' : 'اعمل حساب'}<span aria-hidden="true">←</span></button>
            </form>
            <p className="auth-switch">
              {authMode === 'login' ? 'لسه جديد معانا؟' : 'عندك حساب بالفعل؟'}{' '}
              <button className="text-button" onClick={() => { setAuthError(''); navigateToAuth(authMode === 'login' ? 'register' : 'login'); }}>
                {authMode === 'login' ? 'اعمل حساب' : 'دخول'}
              </button>
            </p>
            <button className="auth-back text-button" onClick={() => navigateToAuth(null)}>← رجوع للصفحة الرئيسية</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="/" onClick={(event) => { event.preventDefault(); navigateTo('overview'); }}><BrandMark /><span className="brand-word">تاسك فلو</span></a>
        <div className="workspace-label"><span className="workspace-dot" /> مساحة شغلك <span className="workspace-menu">•••</span></div>
        <button className={`nav-item ${page === 'overview' ? 'nav-item-active' : ''}`} onClick={() => navigateTo('overview')}><span className="nav-icon">⌂</span> الرئيسية</button>
        <button className={`nav-item ${page === 'inbox' ? 'nav-item-active' : ''}`} onClick={() => navigateTo('inbox')}><span className="nav-icon">✉</span> الدعوات{receivedInvitations.length > 0 && <span className="nav-count">{receivedInvitations.length}</span>}</button>
        <button className={`nav-item ${page === 'sessions' ? 'nav-item-active' : ''}`} onClick={() => navigateTo('sessions')}><span className="nav-icon">◉</span> الجلسات</button>
        <div className="sidebar-section">
          <div className="section-heading">مشاريعك <button aria-label="اعمل مشروع" className="icon-button small" onClick={() => setCreateProjectOpen(true)}>＋</button></div>
          <div className="project-nav-list">
            {projects.map((item) => (
              <button
                key={item.project.id}
                className={`project-nav ${item.project.id === activeProjectId ? 'selected' : ''}`}
                onClick={() => { navigateTo('overview', item.project.id); setError(''); }}
              >
                <span className="project-symbol">{initials(item.project.name).slice(0, 1)}</span>
                <span className="project-nav-name">{item.project.name}</span>
                <span className={`mini-role role-${item.role.toLowerCase()}`} title={`دورك في المشروع: ${roleLabels[item.role]}`}>{item.role.slice(0, 1)}</span>
              </button>
            ))}
            {projects.length === 0 && <p className="sidebar-empty">مشاريعك هتظهر هنا.</p>}
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="help-note"><span>✳</span><div><strong>كل خطوة بتفرق.</strong><p>اتقدم براحتك، خطوة خطوة.</p></div></div>
          <div className="profile-row">
            <span className="avatar avatar-user">{initials(displayName)}</span>
            <span className="profile-name"><strong><bdi dir="auto">{displayName}</bdi></strong><small><bdi dir="ltr">{userEmail}</bdi></small></span>
            <button className="icon-button signout-button" onClick={() => void signOut()} aria-label="تسجيل خروج" title="تسجيل خروج">↗</button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>مساحة الشغل</span><span className="crumb-separator">/</span><strong>{project?.name ?? 'المشاريع'}</strong></div>
          <div className="topbar-right">
            <span className="topbar-date">{new Intl.DateTimeFormat('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span>
            <span className="avatar top-avatar">{initials(displayName)}</span>
          </div>
        </header>

        <div className="content-wrap">
          {error && <div className="alert alert-error page-alert" role="alert"><span>{error}</span><button className="alert-close" onClick={() => setError('')} aria-label="إخفاء">×</button></div>}
          {notice && <div className="alert alert-success page-alert" role="status"><span>{notice}</span><button className="alert-close" onClick={() => setNotice('')} aria-label="إخفاء">×</button></div>}
          {!project && page === 'inbox' ? (
            <ReceivedInvitationsView
              invitations={receivedInvitations}
              onRespond={(invitation, decision) => void respondToInvitation(invitation, decision)}
            />
          ) : !project && page === 'sessions' ? (
            <SessionsView sessions={sessions} onRevoke={(session) => void revokeSession(session)} onSignOut={signOut} onSignOutEverywhere={() => void signOutEverywhere()} />
          ) : !project ? (
            <div className="empty-project">
              <div className="empty-illustration">✳</div>
              <span className="eyebrow">بداية جديدة</span>
              <h1>مشروعك الأول لسه مستني فكرتك.</h1>
              <p>اعملوا مساحة لفريقكم تخططوا فيها، وتشاركوا التحديثات، وتنجزوا سوا.</p>
              <button className="button button-primary" onClick={() => setCreateProjectOpen(true)}>＋ اعمل مشروع</button>
            </div>
          ) : (
            <>
              {page !== 'inbox' && page !== 'sessions' && (
                <>
              <section className="project-heading">
                <div className="project-heading-main">
                  <div className="project-kicker"><span className="project-kicker-dot" /> مساحة المشروع</div>
                  <h1>{project.name}{role && <span className={`role-badge role-${role.toLowerCase()}`}>{roleLabels[role]}</span>}</h1>
                  <p>{project.description || 'مساحة مشتركة للشغل اللي يفرق.'}</p>
                </div>
                <div className="project-heading-actions">
                  {can(role, 'PROJECT_UPDATE') && <button className="button button-secondary" onClick={() => { setProjectForm({ name: project.name, description: project.description ?? '' }); setSettingsOpen(true); }}>إعدادات المشروع <span className="settings-glyph">⚙</span></button>}
                  {can(role, 'TASK_CREATE') && <button className="button button-primary" onClick={() => setCreateTaskOpen(true)}><span>＋</span> اعمل مهمة</button>}
                </div>
              </section>

              <nav className="project-tabs" aria-label="التنقل جوه المشروع">
                {(['overview', 'tasks', 'members', 'invitations'] as Page[])
                  .filter((item) => item !== 'invitations' || can(role, 'INVITATION_MANAGE'))
                  .map((item) => (
                    <button key={item} className={`tab-button ${page === item ? 'active' : ''}`} onClick={() => navigateTo(item)}>
                      {pageLabels[item]}
                      {item === 'tasks' && <span className="tab-count">{tasks.length}</span>}
                      {item === 'members' && <span className="tab-count">{members.length}</span>}
                    </button>
                  ))}
                <span className="tab-spacer" />
                {role && <span className="role-caption"><span className={`role-dot role-${role.toLowerCase()}`} /> دورك هنا: {roleLabels[role]}</span>}
              </nav>
                </>
              )}

              {page === 'inbox' ? (
                <ReceivedInvitationsView
                  invitations={receivedInvitations}
                  onRespond={(invitation, decision) => void respondToInvitation(invitation, decision)}
                />
              ) : page === 'sessions' ? (
                <SessionsView sessions={sessions} onRevoke={(session) => void revokeSession(session)} onSignOut={signOut} onSignOutEverywhere={() => void signOutEverywhere()} />
              ) : projectLoading ? (
                <div className="loading-inline"><span className="spinner" /> بنحمّل المشروع…</div>
              ) : (
                <>
                  {page === 'overview' && (
                    <Overview
                      stats={projectStats}
                      tasks={tasks}
                      members={members}
                      displayName={displayName}
                      onTasks={() => navigateTo('tasks')}
                      onMembers={() => navigateTo('members')}
                    />
                  )}
                  {page === 'tasks' && (
                    <TasksView
                      tasks={tasks}
                      members={members}
                      role={role}
                      userId={userId}
                      commentsByTask={commentsByTask}
                      commentDrafts={commentDrafts}
                      expandedTask={expandedTask}
                      editingComment={editingComment}
                      editingCommentText={editingCommentText}
                      onCreate={() => setCreateTaskOpen(true)}
                      onUpdateTask={updateTask}
                      onDeleteTask={(task) => void deleteTask(task)}
                      onToggleComments={loadComments}
                      onCommentDraft={(taskId, value) => setCommentDrafts((current) => ({ ...current, [taskId]: value }))}
                      onPostComment={postComment}
                      onStartEdit={(comment) => { setEditingComment(comment.id); setEditingCommentText(comment.content); }}
                      onEditText={setEditingCommentText}
                      onSaveComment={saveComment}
                      onCancelEdit={() => setEditingComment(null)}
                      onDeleteComment={deleteComment}
                    />
                  )}
                  {page === 'members' && (
                    <MembersView
                      members={members}
                      role={role}
                      userId={userId}
                      onPromote={(member) => void updateMember(member, 'promote')}
                      onDemote={(member) => void updateMember(member, 'demote')}
                      onRemove={(member) => void removeMember(member)}
                      onLeave={() => void leaveProject()}
                      ownershipTarget={ownershipTarget}
                      onOwnershipTarget={setOwnershipTarget}
                      onTransfer={transferOwnership}
                    />
                  )}
                  {page === 'invitations' && can(role, 'INVITATION_MANAGE') && (
                    <InvitationsView
                      invitations={invitations}
                      form={inviteForm}
                      saving={saving}
                      onForm={setInviteForm}
                      onSubmit={createInvitation}
                      onCancel={(id) => void cancelInvitation(id)}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {createProjectOpen && (
        <Modal title="اعمل مشروع" description="اجمع شغل فريقك كله في مساحة واحدة." onClose={() => setCreateProjectOpen(false)}>
          <form className="stack-form" onSubmit={createProject}>
            <label>اسم المشروع<input autoFocus required minLength={2} value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} placeholder="مثال: إطلاق المنتج" /></label>
            <label>وصف المشروع <span className="optional-label">اختياري · ١٠ حروف على الأقل</span><textarea minLength={10} value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} placeholder="هتشتغلوا سوا على إيه؟" rows={3} /></label>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setCreateProjectOpen(false)}>إلغاء</button><button className="button button-primary" disabled={saving}>{saving ? 'بنعمل المشروع…' : 'اعمل المشروع'}</button></div>
          </form>
        </Modal>
      )}

      {createTaskOpen && can(role, 'TASK_CREATE') && (
        <Modal title="اعمل مهمة" description="ابدأ بخطوة واضحة. تقدر تضيف التفاصيل والفريق بعدين." onClose={() => setCreateTaskOpen(false)}>
          <form className="stack-form" onSubmit={createTask}>
            <label>اسم المهمة<input autoFocus required minLength={4} maxLength={64} value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="إيه اللي محتاج يتعمل؟" /></label>
            <label>تفاصيل <span className="optional-label">اختياري · ١٢ حرف على الأقل</span><textarea minLength={12} maxLength={256} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} placeholder="ضيف تفاصيل تساعد فريقك" rows={3} /></label>
            <label>ميعاد التسليم <span className="optional-label">اختياري</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} /></label>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setCreateTaskOpen(false)}>إلغاء</button><button className="button button-primary" disabled={saving}>{saving ? 'بنعمل المهمة…' : 'اعمل المهمة'}</button></div>
          </form>
        </Modal>
      )}

      {settingsOpen && project && can(role, 'PROJECT_UPDATE') && (
        <Modal title="إعدادات المشروع" description="خلّي تفاصيل المشروع مفيدة ومحدّثة." onClose={() => setSettingsOpen(false)}>
          <form className="stack-form" onSubmit={updateProject}>
            <label>اسم المشروع<input autoFocus required minLength={2} value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} /></label>
            <label>وصف المشروع <span className="optional-label">اختياري · ١٠ حروف على الأقل</span><textarea minLength={10} value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} rows={4} /></label>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setSettingsOpen(false)}>إلغاء</button><button className="button button-primary" disabled={saving}>{saving ? 'بنسيّف…' : 'احفظ التغييرات'}</button></div>
          </form>
          {can(role, 'PROJECT_DELETE') && (
            <div className="danger-zone">
              <div><strong>امسح المشروع</strong><p>المهام والتعليقات والأعضاء هيتشالوا معاه.</p></div>
              <button type="button" className="button button-danger button-small" onClick={() => void deleteProject()}>امسح المشروع</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Overview({
  stats,
  tasks,
  members,
  displayName,
  onTasks,
  onMembers,
}: {
  stats: { label: string; value: number; note: string }[];
  tasks: Task[];
  members: Member[];
  displayName: string;
  onTasks: () => void;
  onMembers: () => void;
}) {
  const recentTasks = [...tasks].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 4);
  return (
    <div className="page-content overview-page">
      <section className="welcome-banner">
        <div className="welcome-copy"><span className="eyebrow">يوم حلو ننجز فيه</span><h2><span>منور يا</span><bdi className="welcome-name" dir="ltr">{displayName}</bdi></h2><p>اختار حاجة واحدة تحركها لقدّام. الباقي يستنى شوية.</p></div>
        <div className="sun-art" aria-hidden="true"><span className="sun-core">✳</span><span className="sun-orbit orbit-one" /><span className="sun-orbit orbit-two" /></div>
      </section>
      <div className="stat-grid">
        {stats.map((stat, index) => <div className="stat-card" key={stat.label}><div className={`stat-icon stat-icon-${index}`}>{['↗', '◷', '✓', '◎'][index]}</div><span className="stat-label">{stat.label}</span><strong>{stat.value}</strong><small>{stat.note}</small></div>)}
      </div>
      <div className="overview-grid">
        <section className="surface-card recent-card">
          <div className="card-heading"><div><span className="eyebrow">كمّلوا بنفس الحماس</span><h3>آخر المهام اللي عليها شغل</h3></div><button className="text-button" onClick={onTasks}>شوف الكل <span>←</span></button></div>
          {recentTasks.length ? (
            <div className="recent-list">
              {recentTasks.map((task) => <div className="recent-row" key={task.id}><span className={`task-check status-${task.status.toLowerCase()}`}>{task.status === 'DONE' ? '✓' : ''}</span><span className="recent-name"><strong>{task.title}</strong><small>{task.assignee?.name ? `مع ${task.assignee.name}` : 'مستنية حد يمسكها'}</small></span><span className={`status-pill status-${task.status.toLowerCase()}`}>{statusLabels[task.status]}</span></div>)}
            </div>
          ) : <div className="inline-empty"><span className="empty-spark">✳</span><p>لسه مفيش مهام. أول خطوة صغيرة بداية حلوة.</p></div>}
        </section>
        <section className="surface-card people-card">
          <div className="card-heading"><div><span className="eyebrow">سوا أحسن</span><h3>فريق المشروع</h3></div><button className="text-button" onClick={onMembers}>شوف الكل <span>←</span></button></div>
          <div className="people-preview">
            {members.slice(0, 4).map((member, index) => <div className="people-preview-row" key={member.user.id}><span className={`avatar avatar-color-${index % 4}`}>{initials(member.user.name)}</span><span className="people-preview-name"><strong>{member.user.name}</strong><small>{roleLabels[member.role]}</small></span>{member.role === 'OWNER' && <span className="owner-mark">المالك</span>}</div>)}
            {!members.length && <p className="muted">فريق المشروع هيظهر هنا.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function TasksView({
  tasks,
  members,
  role,
  userId,
  commentsByTask,
  commentDrafts,
  expandedTask,
  editingComment,
  editingCommentText,
  onCreate,
  onUpdateTask,
  onDeleteTask,
  onToggleComments,
  onCommentDraft,
  onPostComment,
  onStartEdit,
  onEditText,
  onSaveComment,
  onCancelEdit,
  onDeleteComment,
}: {
  tasks: Task[];
  members: Member[];
  role?: ProjectRole;
  userId: string | null;
  commentsByTask: Record<string, Comment[]>;
  commentDrafts: Record<string, string>;
  expandedTask: string | null;
  editingComment: string | null;
  editingCommentText: string;
  onCreate: () => void;
  onUpdateTask: (task: Task, endpoint: 'status' | 'priority' | 'assign' | 'unassign' | 'edit', value: string) => void;
  onDeleteTask: (task: Task) => void;
  onToggleComments: (taskId: string) => void;
  onCommentDraft: (taskId: string, value: string) => void;
  onPostComment: (event: FormEvent<HTMLFormElement>, taskId: string) => void;
  onStartEdit: (comment: Comment) => void;
  onEditText: (value: string) => void;
  onSaveComment: (commentId: string, taskId: string) => void;
  onCancelEdit: () => void;
  onDeleteComment: (commentId: string, taskId: string) => void;
}) {
  const [filter, setFilter] = useState<'ALL' | TaskStatus>('ALL');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState({ title: '', description: '', dueDate: '' });
  const filteredTasks = tasks.filter((task) => filter === 'ALL' || task.status === filter);

  return (
    <div className="page-content tasks-page">
      <div className="page-title-row"><div><span className="eyebrow">مهمة ورا مهمة</span><h2>مهام المشروع <span className="title-count">{tasks.length}</span></h2><p>لما الخطوة الجاية تبقى واضحة، الشغل بيبقى أسهل.</p></div>{can(role, 'TASK_CREATE') && <button className="button button-primary" onClick={onCreate}>＋ اعمل مهمة</button>}</div>
      <div className="filter-bar"><div className="filter-tabs">{(['ALL', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const).map((item) => <button key={item} className={`filter-tab ${filter === item ? 'selected' : ''}`} onClick={() => setFilter(item)}>{item === 'ALL' ? 'كل المهام' : statusLabels[item]}</button>)}</div><span className="filter-result">{filteredTasks.length} مهمة</span></div>
      {!filteredTasks.length ? (
        <div className="surface-card task-empty"><span className="empty-spark">✳</span><h3>{tasks.length ? 'مفيش مهام بالحالة دي' : 'مساحة فاضية لفكرتكم الجاية.'}</h3><p>{tasks.length ? 'جرّب تختار حالة تانية.' : 'المهام بتقسّم الشغل لخطوات صغيرة وواضحة.'}</p>{!tasks.length && can(role, 'TASK_CREATE') && <button className="button button-primary" onClick={onCreate}>＋ اعمل أول مهمة</button>}</div>
      ) : (
        <div className="task-list">
          {filteredTasks.map((task) => {
            const mayManage = can(role, 'TASK_UPDATE');
            const mayChangeStatus = canChangeTaskStatus(role, task.assigneeId, userId);
            const mayAssign = can(role, 'TASK_ASSIGN');
            const canComment = can(role, 'COMMENT_CREATE');
            const availableMembers = members.filter((member) =>
              canAssignTo(role, member.role) || member.user.id === task.assigneeId,
            );
            return (
              <article className={`task-card ${task.status === 'DONE' ? 'task-card-done' : ''}`} key={task.id}>
                <div className="task-card-main">
                  <span className={`task-check large status-${task.status.toLowerCase()}`}>{task.status === 'DONE' ? '✓' : ''}</span>
                  <div className="task-card-copy">
                    {editingTask === task.id ? (
                      <form className="task-edit-form" onSubmit={(event) => { event.preventDefault(); void onUpdateTask(task, 'edit', JSON.stringify({ title: editTaskForm.title.trim(), description: editTaskForm.description.trim() || undefined, dueDate: editTaskForm.dueDate || null })); setEditingTask(null); }}>
                        <input aria-label="اسم المهمة" required minLength={4} maxLength={64} value={editTaskForm.title} onChange={(event) => setEditTaskForm({ ...editTaskForm, title: event.target.value })} />
                        <input aria-label="وصف المهمة" placeholder="تفاصيل اختيارية" value={editTaskForm.description} onChange={(event) => setEditTaskForm({ ...editTaskForm, description: event.target.value })} />
                        <input aria-label="ميعاد التسليم" type="date" value={editTaskForm.dueDate} onChange={(event) => setEditTaskForm({ ...editTaskForm, dueDate: event.target.value })} />
                        <button className="text-button" type="submit">احفظ</button><button className="text-button muted-button" type="button" onClick={() => setEditingTask(null)}>إلغاء</button>
                      </form>
                    ) : (
                      <>
                        <div className="task-title-line"><h3 className={task.status === 'DONE' ? 'completed-title' : ''}>{task.title}</h3><span className={`priority-dot priority-${task.priority.toLowerCase()}`} title={`${priorityLabels[task.priority]} priority`} /></div>
                        {task.description && <p className="task-description">{task.description}</p>}
                      </>
                    )}
                    <div className="task-meta"><span className="due-label"><span>◷</span> {dateLabel(task.dueDate)}</span><span className="meta-divider" /><span>{task.assignee ? `مسؤول عنها: ${task.assignee.name}` : 'من غير مسؤول'}</span></div>
                  </div>
                  <div className="task-controls">
                    {mayChangeStatus ? (
                      <label className="control-label"><span>الحالة</span><select className={`status-select status-${task.status.toLowerCase()}`} aria-label={`غيّر حالة ${task.title}`} value={task.status} onChange={(event) => void onUpdateTask(task, 'status', event.target.value)}>{(Object.keys(statusLabels) as TaskStatus[]).map((status) => <option key={status} value={status} disabled={(!task.assigneeId && (status === 'IN_PROGRESS' || status === 'DONE')) || (task.status === 'DONE' && status === 'CANCELLED')}>{statusLabels[status]}</option>)}</select></label>
                    ) : <span className={`status-pill status-${task.status.toLowerCase()}`}>{statusLabels[task.status]}</span>}
                    {mayManage && (
                      <button className="icon-button task-more" title="تعديل المهمة" aria-label={`تعديل ${task.title}`} onClick={() => { setEditTaskForm({ title: task.title, description: task.description ?? '', dueDate: task.dueDate?.slice(0, 10) ?? '' }); setEditingTask(task.id); }}>✎</button>
                    )}
                    {can(role, 'TASK_DELETE') && <button className="icon-button task-delete" title="مسح المهمة" aria-label={`مسح ${task.title}`} onClick={() => onDeleteTask(task)}>×</button>}
                  </div>
                </div>
                <div className="task-card-footer">
                  <div className="task-footer-left">
                    {mayAssign && <label className="control-label compact-control"><span>المسؤول</span><select aria-label={`عيّن مسؤول لـ ${task.title}`} value={task.assigneeId ?? ''} onChange={(event) => { const value = event.target.value; void onUpdateTask(task, value ? 'assign' : 'unassign', value); }}><option value="">من غير مسؤول</option>{availableMembers.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name}</option>)}</select></label>}
                    {can(role, 'TASK_UPDATE_PRIORITY') ? <label className="control-label compact-control"><span>الأولوية</span><select aria-label={`غيّر أولوية ${task.title}`} value={task.priority} onChange={(event) => void onUpdateTask(task, 'priority', event.target.value)}>{(Object.keys(priorityLabels) as TaskPriority[]).map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></label> : <span className={`priority-chip priority-${task.priority.toLowerCase()}`}>أولوية {priorityLabels[task.priority]}</span>}
                  </div>
                  <button className="comments-toggle" onClick={() => void onToggleComments(task.id)}><span className="comment-icon">▤</span> {expandedTask === task.id ? 'اخفي التعليقات' : 'التعليقات'} {commentsByTask[task.id]?.length ? <span className="comment-count">{commentsByTask[task.id].length}</span> : null}</button>
                </div>
                {expandedTask === task.id && (
                  <div className="comments-panel">
                    <div className="comments-heading"><strong>الكلام على المهمة</strong><span>{commentsByTask[task.id]?.length ?? 0} تعليق</span></div>
                    {(commentsByTask[task.id] ?? []).length ? <div className="comment-list">{commentsByTask[task.id].map((comment) => {
                      const own = comment.authorId === userId;
                      const mayDelete = own || can(role, 'COMMENT_DELETE_ANY');
                      return <div className="comment-row" key={comment.id}><span className="avatar comment-avatar">{initials(comment.author.name)}</span><div className="comment-body"><div className="comment-byline"><strong>{comment.author.name}</strong><time>{new Intl.DateTimeFormat('ar-EG', { month: 'short', day: 'numeric' }).format(new Date(comment.createdAt))}</time></div>{editingComment === comment.id ? <div className="comment-edit"><textarea value={editingCommentText} onChange={(event) => onEditText(event.target.value)} /><button className="text-button" onClick={() => void onSaveComment(comment.id, task.id)}>احفظ</button><button className="text-button muted-button" onClick={onCancelEdit}>إلغاء</button></div> : <p>{comment.content}</p>}</div><div className="comment-actions">{own && can(role, 'COMMENT_UPDATE_OWN') && editingComment !== comment.id && <button className="icon-button" title="عدّل تعليقك" onClick={() => onStartEdit(comment)}>✎</button>}{mayDelete && <button className="icon-button delete-icon" title="امسح التعليق" onClick={() => void onDeleteComment(comment.id, task.id)}>×</button>}</div></div>;
                    })}</div> : <p className="no-comments">لسه مفيش تعليقات. اكتب أول ملاحظة وابدأوا الكلام.</p>}
                    {canComment && <form className="comment-composer" onSubmit={(event) => onPostComment(event, task.id)}><span className="avatar composer-avatar">{initials(userId?.slice(0, 2) ?? 'ME')}</span><input aria-label="اكتب تعليق" value={commentDrafts[task.id] ?? ''} onChange={(event) => onCommentDraft(task.id, event.target.value)} placeholder="اكتب تعليقك…" required /><button className="button button-primary button-small">إرسال</button></form>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MembersView({
  members,
  role,
  userId,
  onPromote,
  onDemote,
  onRemove,
  onLeave,
  ownershipTarget,
  onOwnershipTarget,
  onTransfer,
}: {
  members: Member[];
  role?: ProjectRole;
  userId: string | null;
  onPromote: (member: Member) => void;
  onDemote: (member: Member) => void;
  onRemove: (member: Member) => void;
  onLeave: () => void;
  ownershipTarget: string;
  onOwnershipTarget: (id: string) => void;
  onTransfer: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const groups: { role: ProjectRole; label: string; description: string }[] = [
    { role: 'OWNER', label: 'مالك المشروع', description: 'مسؤول عن إدارة المشروع' },
    { role: 'MANAGER', label: 'المديرين', description: 'بينظّموا الشغل وبيتابعوه' },
    { role: 'MEMBER', label: 'الأعضاء', description: 'بيشتغلوا على المهام المسندة ليهم' },
  ];
  return (
    <div className="page-content members-page">
      <div className="page-title-row"><div><span className="eyebrow">الناس اللي ورا كل إنجاز</span><h2>أعضاء المشروع <span className="title-count">{members.length}</span></h2><p>الأدوار دي خاصة بالمشروع ده. ممكن يكون للشخص دور تاني في مشروع غيره.</p></div></div>
      <section className="surface-card members-directory">
        {groups.map((group) => {
          const groupMembers = members.filter((member) => member.role === group.role);
          return <section className="member-group" key={group.role}><div className="member-group-heading"><div><h3>{group.label}</h3><p>{group.description}</p></div><span className="group-count">{groupMembers.length}</span></div>{groupMembers.length ? groupMembers.map((member, index) => <div className="member-row" key={member.user.id}><span className={`avatar avatar-color-${index % 4}`}>{initials(member.user.name)}</span><div className="member-details"><strong>{member.user.name}</strong><span>{member.user.email}</span></div><span className={`role-badge role-${member.role.toLowerCase()}`}>{roleLabels[member.role]}</span>{can(role, 'PROJECT_MANAGE_MANAGERS') && member.role !== 'OWNER' && <div className="member-management">{member.role === 'MEMBER' ? <button className="button button-secondary button-small" onClick={() => onPromote(member)}>خلّيه مدير</button> : <button className="button button-secondary button-small" onClick={() => onDemote(member)}>رجّعه عضو</button>}</div>}{can(role, 'MEMBER_MANAGE') && member.role !== 'OWNER' && member.user.id !== userId && <button className="icon-button delete-icon" aria-label={`شيل ${member.user.name}`} title={`شيل ${member.user.name}`} onClick={() => onRemove(member)}>×</button>}</div>) : <p className="group-empty">لسه مفيش {group.label} هنا.</p>}</section>;
        })}
      </section>
      {can(role, 'PROJECT_TRANSFER_OWNERSHIP') && members.filter((member) => member.role !== 'OWNER').length > 0 && (
        <section className="surface-card transfer-card"><div><span className="eyebrow">للمالك بس</span><h3>انقل ملكية المشروع</h3><p>اختار عضو تاني يبقى المالك. إنت هتفضل مدير في المشروع.</p></div><form className="transfer-form" onSubmit={onTransfer}><select aria-label="المالك الجديد للمشروع" value={ownershipTarget} onChange={(event) => onOwnershipTarget(event.target.value)} required>{members.filter((member) => member.role !== 'OWNER').map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name} · {roleLabels[member.role]}</option>)}</select><button className="button button-secondary">انقل الملكية</button></form></section>
      )}
      {can(role, 'PROJECT_LEAVE') && (
        <section className="surface-card leave-card"><div><span className="eyebrow">عضويتك</span><h3>سيب المشروع</h3><p>المهام اللي عليك هتتشال منك وترجع من غير مسؤول.</p></div><button className="button button-secondary button-small" onClick={onLeave}>سيب المشروع</button></section>
      )}
    </div>
  );
}

function InvitationsView({
  invitations,
  form,
  saving,
  onForm,
  onSubmit,
  onCancel,
}: {
  invitations: Invitation[];
  form: { inviteeId: string; role: string };
  saving: boolean;
  onForm: (value: { inviteeId: string; role: string }) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: (id: string) => void;
}) {
  return (
    <div className="page-content invitations-page">
      <div className="page-title-row"><div><span className="eyebrow">كبّروا فريق الشغل</span><h2>الدعوات</h2><p>ادعي حد عنده حساب ينضم للمشروع.</p></div></div>
      <div className="invitation-layout">
        <section className="surface-card invite-form-card"><div className="card-heading"><div><span className="eyebrow">وسعوا دايرة الفريق</span><h3>ادعي حد</h3></div><span className="invite-spark">✳</span></div><form className="stack-form" onSubmit={onSubmit}><label>رقم حساب الشخص<input required value={form.inviteeId} onChange={(event) => onForm({ ...form, inviteeId: event.target.value })} placeholder="حط رقم حسابه هنا" /></label><p className="field-hint">لازم يكون عنده حساب. خليه يبعتلك رقم حسابه.</p><label>دوره في المشروع<select value={form.role} onChange={(event) => onForm({ ...form, role: event.target.value })}><option value="MEMBER">عضو</option><option value="MANAGER">مدير</option></select></label><button className="button button-primary button-wide" disabled={saving}>{saving ? 'بنبعت الدعوة…' : 'ابعت الدعوة'}<span>←</span></button></form></section>
        <section className="surface-card invitations-list-card"><div className="card-heading"><div><span className="eyebrow">الدعوات اللي اتبعتت</span><h3>الدعوات الصادرة</h3></div><span className="group-count">{invitations.length}</span></div>{invitations.length ? <div className="invitation-list">{invitations.map((invitation) => <div className="invitation-row" key={invitation.id}><span className={`avatar avatar-color-${invitations.indexOf(invitation) % 4}`}>{initials(invitation.invitee?.name ?? 'U')}</span><div className="member-details"><strong>{invitation.invitee?.name ?? invitation.inviteeId}</strong><span>{invitation.invitee?.email ?? invitation.inviteeId}</span></div><div className="invitation-state"><span className={`invitation-status invitation-${invitation.status.toLowerCase()}`}>{invitation.status === 'PENDING' ? 'معلّقة' : invitation.status === 'ACCEPTED' ? 'مقبولة' : 'مرفوضة'}</span><small>{roleLabels[invitation.role]}</small></div>{invitation.status === 'PENDING' && <button className="icon-button delete-icon" aria-label="إلغاء الدعوة" title="إلغاء الدعوة" onClick={() => onCancel(invitation.id)}>×</button>}</div>)}</div> : <div className="inline-empty"><span className="empty-spark">✳</span><p>لسه مفيش دعوات. لما تدعي حد هتشوف حالة الدعوة هنا.</p></div>}</section>
      </div>
    </div>
  );
}

function ReceivedInvitationsView({
  invitations,
  onRespond,
}: {
  invitations: Invitation[];
  onRespond: (invitation: Invitation, decision: 'accept' | 'reject') => void;
}) {
  const pending = invitations.filter((invitation) => invitation.status === 'PENDING');
  const history = invitations.filter((invitation) => invitation.status !== 'PENDING');
  return (
    <div className="page-content invitations-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">مكانك مستنيك</span>
          <h2>دعواتك <span className="title-count">{pending.length}</span></h2>
          <p>راجع دعوات المشاريع اللي وصلتك.</p>
        </div>
      </div>
      <section className="surface-card received-invitations">
        {pending.length ? pending.map((invitation, index) => (
          <article className="received-invitation" key={invitation.id}>
            <span className={`avatar avatar-color-${index % 4}`}>{initials(invitation.project?.name ?? 'P')}</span>
            <div className="received-invitation-copy">
              <strong>{invitation.project?.name ?? 'دعوة مشروع'}</strong>
              <p>{invitation.inviter?.name ?? 'حد من الفريق'} دعاك تنضم كـ <span className={`role-badge role-${invitation.role.toLowerCase()}`}>{roleLabels[invitation.role]}</span></p>
              <small>صالحة لحد {dateLabel(invitation.expiresAt)}</small>
            </div>
            <div className="received-invitation-actions">
              <button className="button button-secondary button-small" onClick={() => onRespond(invitation, 'reject')}>اعتذر</button>
              <button className="button button-primary button-small" onClick={() => onRespond(invitation, 'accept')}>اقبل الدعوة</button>
            </div>
          </article>
        )) : (
          <div className="inline-empty received-empty"><span className="empty-spark">✳</span><h3>كده إنت متابع كل حاجة.</h3><p>لما حد يدعوك لمشروع، هتقدر ترد من هنا.</p></div>
        )}
      </section>
      {history.length > 0 && (
        <section className="surface-card invitation-history">
          <div className="card-heading"><div><span className="eyebrow">دعوات فاتت</span><h3>سجل الدعوات</h3></div></div>
          {history.map((invitation) => (
            <div className="invitation-row" key={invitation.id}>
              <span className="avatar avatar-color-2">{initials(invitation.project?.name ?? 'م')}</span>
              <div className="member-details"><strong>{invitation.project?.name ?? 'دعوة مشروع'}</strong><span>من {invitation.inviter?.name ?? 'حد من الفريق'}</span></div>
              <span className={`invitation-status invitation-${invitation.status.toLowerCase()}`}>{invitation.status === 'ACCEPTED' ? 'مقبولة' : invitation.status === 'REJECTED' ? 'مرفوضة' : invitation.status}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function SessionsView({
  sessions,
  onRevoke,
  onSignOut,
  onSignOutEverywhere,
}: {
  sessions: AuthSession[];
  onRevoke: (session: AuthSession) => void;
  onSignOut: () => void;
  onSignOutEverywhere: () => void;
}) {
  return (
    <div className="page-content sessions-page">
      <div className="page-title-row">
        <div>
          <span className="eyebrow">حسابك، وإنت المتحكم</span>
          <h2>الجلسات النشطة <span className="title-count">{sessions.length}</span></h2>
          <p>راجع الأجهزة اللي فاتحة حسابك دلوقتي.</p>
        </div>
        <button className="button button-secondary" onClick={onSignOutEverywhere}>سجّل خروج من كل الأجهزة</button>
      </div>
      <section className="surface-card sessions-list">
        {sessions.length ? sessions.map((session) => (
          <div className="session-row" key={session.id}>
            <span className={`session-device ${session.current ? 'session-device-current' : ''}`}>{session.current ? '⌂' : '◉'}</span>
            <div className="session-copy">
              <strong>{session.current ? 'الجهاز ده' : 'جهاز مسجل'}{session.current && <span className="current-session-badge">الحالي</span>}</strong>
              <span>بدأت {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.createdAt))}</span>
              <small>الجلسة بتنتهي {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(session.expiresAt))}</small>
            </div>
            {session.current
              ? <button className="text-button" onClick={onSignOut}>تسجيل خروج</button>
              : <button className="button button-secondary button-small" onClick={() => onRevoke(session)}>إلغاء الجلسة</button>}
          </div>
        )) : (
          <div className="inline-empty received-empty"><span className="empty-spark">✳</span><h3>مفيش جلسات نشطة</h3><p>مفيش أجهزة مسجلة دخول نعرضها.</p></div>
        )}
      </section>
      <p className="session-security-note">لو مش عارف جهاز، الغي جلسته وسجّل خروج من كل الأجهزة.</p>
    </div>
  );
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" aria-label="اقفل النافذة" onClick={onClose}>×</button><span className="eyebrow">تاسك فلو</span><h2 id="modal-title">{title}</h2><p className="modal-description">{description}</p>{children}</section></div>;
}
