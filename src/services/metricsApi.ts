import { TaskMetrics } from '../types/tasks';

export interface MetricsResponse {
  metrics: TaskMetrics[];
  cached: boolean;
  cachedAt?: string;
  calculatedAt?: string;
}

export async function fetchTaskMetrics(): Promise<MetricsResponse> {
  const response = await fetch('/api/task-metrics');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch metrics: ${response.status}`);
  }

  return await response.json();
}