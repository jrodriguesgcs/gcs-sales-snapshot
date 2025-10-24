import { useState, useEffect, useRef } from 'react';
import { Task, TaskMetrics, LoadingProgress as LoadingProgressType } from '../types/tasks';
import { fetchUsers, fetchTasks } from '../services/tasksApi';
import { isTaskOverdue } from '../utils/dateUtils';
import { shouldExcludeOwner } from '../utils/nameUtils';
import LoadingProgress from './LoadingProgress';

type DateFilter = 'last7days' | 'last30days' | 'alltime';

export default function Tab2Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgressType>({
    phase: 'idle',
    message: '',
    current: 0,
    total: 0,
    percentage: 0,
  });
  const [dateFilter, setDateFilter] = useState<DateFilter>('last7days');
  const [error, setError] = useState<string | null>(null);
  const [hasMoreTasks, setHasMoreTasks] = useState(true);
  const backgroundLoadingRef = useRef<boolean>(false);
  const nextBatchRef = useRef<Task[]>([]);

  useEffect(() => {
    loadInitialData();
  }, [dateFilter]);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    setTasks([]);
    setHasMoreTasks(true);
    nextBatchRef.current = [];

    try {
      // Load users first
      const users = await fetchUsers(setLoadingProgress);
      setUserMap(users);

      // Load first 1000 tasks
      const initialTasks = await fetchTasks(dateFilter, setLoadingProgress, 1000);
      setTasks(initialTasks);

      if (initialTasks.length < 1000) {
        setHasMoreTasks(false);
        setLoadingProgress({
          phase: 'complete',
          message: '✓ All tasks loaded',
          current: initialTasks.length,
          total: initialTasks.length,
          percentage: 100,
        });
      } else {
        // Start background loading next batch
        startBackgroundLoading();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tasks';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const startBackgroundLoading = async () => {
    if (backgroundLoadingRef.current) return;
    backgroundLoadingRef.current = true;

    try {
      const nextBatch = await fetchTasks(
        dateFilter,
        (progress) => {
          // Silent background loading
          console.log('Background loading:', progress);
        },
        1000
      );

      nextBatchRef.current = nextBatch;

      if (nextBatch.length < 1000) {
        setHasMoreTasks(false);
      }
    } catch (error) {
      console.error('Background loading error:', error);
    } finally {
      backgroundLoadingRef.current = false;
    }
  };

  const handleLoadMore = () => {
    if (nextBatchRef.current.length > 0) {
      setTasks(prev => [...prev, ...nextBatchRef.current]);
      
      const loadedCount = nextBatchRef.current.length;
      nextBatchRef.current = [];

      if (loadedCount >= 1000) {
        // Start loading next batch in background
        startBackgroundLoading();
      } else {
        setHasMoreTasks(false);
        setLoadingProgress({
          phase: 'complete',
          message: '✓ All tasks loaded',
          current: tasks.length + loadedCount,
          total: tasks.length + loadedCount,
          percentage: 100,
        });
      }
    }
  };

  // Calculate metrics
  const metrics: TaskMetrics[] = (() => {
    const metricsMap = new Map<string, TaskMetrics>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tasks.forEach(task => {
      const userId = task.assignee_userid;
      const userName = userMap.get(userId) || `User ${userId}`;

      // Exclude operator (ID 16)
      if (userId === '16' || shouldExcludeOwner(userName, userId)) {
        return;
      }

      if (!metricsMap.has(userName)) {
        metricsMap.set(userName, {
          owner: userName,
          total: 0,
          completed: 0,
          overdue: 0,
          incompleteNoDueDate: 0,
        });
      }

      const metric = metricsMap.get(userName)!;
      metric.total++;

      if (task.status === 1) {
        metric.completed++;
      } else {
        // Incomplete
        if (!task.duedate) {
          metric.incompleteNoDueDate++;
        } else if (isTaskOverdue(task)) {
          metric.overdue++;
        }
      }
    });

    return Array.from(metricsMap.values()).sort((a, b) =>
      a.owner.localeCompare(b.owner)
    );
  })();

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-red-900 font-semibold mb-1">Failed to load tasks</h3>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={loadInitialData}
              className="mt-3 text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isLoading && <LoadingProgress progress={loadingProgress} />}

      {/* Date Filter */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Task Created Date:</label>
          <div className="flex space-x-2">
            <button
              onClick={() => setDateFilter('last7days')}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                dateFilter === 'last7days'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setDateFilter('last30days')}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                dateFilter === 'last30days'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setDateFilter('alltime')}
              className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                dateFilter === 'alltime'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Showing {tasks.length} tasks
          {!hasMoreTasks && ' (all tasks loaded)'}
        </p>
      </div>

      {/* Metrics Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Task Metrics by Owner</h3>
          <p className="text-gray-600 text-sm mt-0.5">Task completion and overdue statistics</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Deal Owner</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Total Tasks</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Completed</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Overdue</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Incomplete (No Due Date)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metrics.map(metric => (
                <tr key={metric.owner} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {metric.owner}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                    {metric.total}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-green-600">
                    {metric.completed}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-red-600">
                    {metric.overdue}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-yellow-600">
                    {metric.incompleteNoDueDate}
                  </td>
                </tr>
              ))}

              {metrics.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No tasks found matching the selected filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load More Button */}
      {hasMoreTasks && !isLoading && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            disabled={nextBatchRef.current.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {nextBatchRef.current.length === 0 ? 'Loading more tasks...' : `Load More (${nextBatchRef.current.length} ready)`}
          </button>
        </div>
      )}
    </div>
  );
}