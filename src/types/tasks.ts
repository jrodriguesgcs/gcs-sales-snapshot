export interface Task {
  id: string;
  title: string;
  status: string | number;
  duedate: string | null;
  assignee: string;
  cdate: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface TaskMetrics {
  owner: string;
  ownerId: string;
  total: number;
  completed: number;
  overdue: number;
  openFutureDueDate: number;
  openNoDueDate: number;
}

export interface LoadingProgress {
  phase: 'idle' | 'users' | 'deals' | 'tasks' | 'processing' | 'complete';
  message: string;
  current: number;
  total: number;
  percentage: number;
}