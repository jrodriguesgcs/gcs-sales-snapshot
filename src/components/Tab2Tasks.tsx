import { useState, useEffect } from 'react';
import { TaskMetrics } from '../types/tasks';
import { fetchTaskMetrics, MetricsResponse } from '../services/metricsApi';

export default function Tab2Tasks() {
  const [metricsData, setMetricsData] = useState<MetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔵 Fetching task metrics from backend...');
      const data = await fetchTaskMetrics();
      console.log('✅ Metrics received:', data);
      setMetricsData(data);
    } catch (err) {
      console.error('❌ Error loading metrics:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load metrics';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-red-900 font-semibold mb-1">Failed to load task metrics</h3>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={loadMetrics}
              className="mt-3 text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Loading Task Metrics</h3>
        <p className="text-gray-600">
          Calculating metrics from all deals and tasks...
          <br />
          <span className="text-sm text-gray-500">This may take 2-3 minutes on first load, then results are cached for 1 hour.</span>
        </p>
      </div>
    );
  }

  const metrics = metricsData?.metrics || [];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing metrics for {metrics.length} deal owners
          </p>
          {metricsData && (
            <div className="flex items-center space-x-2">
              {metricsData.cached ? (
                <span className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  ✓ Cached data from {new Date(metricsData.cachedAt!).toLocaleTimeString()}
                </span>
              ) : (
                <span className="text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  ✓ Fresh data calculated at {new Date(metricsData.calculatedAt!).toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={loadMetrics}
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
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
                    No metrics found
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