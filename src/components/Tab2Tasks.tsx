import { useState, useEffect } from 'react';
import { TaskMetrics, LoadingProgress as LoadingProgressType } from '../types/tasks';
import { fetchDealsAndTasks, Deal, DealTask } from '../services/dealsApi';
import { fetchUsers } from '../services/tasksApi';
import { isTaskOverdue, isTaskFutureDueDate } from '../utils/dateUtils';
import { cleanOwnerName } from '../utils/nameUtils';
import LoadingProgress from './LoadingProgress';

export default function Tab2Tasks() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgressType>({
    phase: 'idle',
    message: '',
    current: 0,
    total: 0,
    percentage: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load users first to get owner names
      console.log('🔵 Loading users...');
      const users = await fetchUsers(setLoadingProgress);
      console.log('✅ Users loaded:', users.size);
      setUserMap(users);

      // Load deals and tasks
      console.log('🔵 Loading deals and tasks...');
      const { deals: loadedDeals, tasks: loadedTasks } = await fetchDealsAndTasks(setLoadingProgress);
      
      console.log('✅ Deals loaded:', loadedDeals.length);
      console.log('✅ Tasks loaded:', loadedTasks.length);
      
      setDeals(loadedDeals);
      setTasks(loadedTasks);
    } catch (err) {
      console.error('❌ Error loading data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate metrics by deal owner
  const metrics: TaskMetrics[] = (() => {
    const metricsMap = new Map<string, TaskMetrics>();

    // Group tasks by deal owner
    deals.forEach(deal => {
      const ownerId = deal.owner;
      const ownerName = userMap.get(ownerId) || `User ${ownerId}`;
      const cleanName = cleanOwnerName(ownerName);

      if (!metricsMap.has(ownerId)) {
        metricsMap.set(ownerId, {
          owner: cleanName,
          ownerId: ownerId,
          total: 0,
          completed: 0,
          overdue: 0,
          openFutureDueDate: 0,
          openNoDueDate: 0,
        });
      }

      const metric = metricsMap.get(ownerId)!;

      // Find all tasks for this deal
      const dealTasks = tasks.filter(task => task.dealId === deal.id);

      dealTasks.forEach(task => {
        metric.total++;

        const isCompleted = task.status === 1 || task.status === '1';

        if (isCompleted) {
          metric.completed++;
        } else {
          // Incomplete task - categorize by due date status
          if (!task.duedate) {
            metric.openNoDueDate++;
          } else if (isTaskOverdue(task)) {
            metric.overdue++;
          } else if (isTaskFutureDueDate(task)) {
            metric.openFutureDueDate++;
          }
        }
      });
    });

    // Convert to array and sort by owner name (A-Z)
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

      {/* Summary */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <p className="text-sm text-gray-500">
          Showing {tasks.length} tasks from {deals.length} deals across {metrics.length} owners
        </p>
      </div>

      {/* Metrics Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Task Metrics by Deal Owner</h3>
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
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Open (Future Due Date)</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Open (No Due Date)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metrics.map(metric => (
                <tr key={metric.ownerId} className="hover:bg-gray-50 transition-colors">
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
                  <td className="px-6 py-4 text-right text-sm font-semibold text-blue-600">
                    {metric.openFutureDueDate}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-yellow-600">
                    {metric.openNoDueDate}
                  </td>
                </tr>
              ))}

              {metrics.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No tasks found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}