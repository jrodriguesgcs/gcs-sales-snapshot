export interface Task {
  id: string;
  title: string;
  status: number; // 0 = incomplete, 1 = complete
  duedate: string | null;
  assignee_userid: string;
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
  total: number;
  completed: number;
  overdue: number;
  incompleteNoDueDate: number;
}

export interface LoadingProgress {
  phase: 'idle' | 'users' | 'tasks' | 'processing' | 'complete';
  message: string;
  current: number;
  total: number;
  percentage: number;
}