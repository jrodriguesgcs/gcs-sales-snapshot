import { useState, useEffect } from 'react';
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
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className="text-yellow-900 font-semibold mb-1">Metrics Not Yet Available</h3>
            <p className="text-yellow-700 text-sm mb-3">
              Task metrics are calculated daily at 5:00 AM Lisbon time. Please check back after the next calculation runs.
            </p>
            <button
              onClick={loadMetrics}
              className="text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Check Again
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
        <p className="text-gray-600 text-sm">Retrieving pre-calculated metrics...</p>
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
            Showing metrics for {metrics.length} deal owners (last 12 months)
          </p>
          {metricsData && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-green-600 bg-green-50 px-3 py-1 rounded-full">
                ✓ Calculated at {new Date(metricsData.calculatedAt!).toLocaleString('en-US', { 
                  timeZone: 'Europe/Lisbon',
                  dateStyle: 'short',
                  timeStyle: 'short'
                })} (Lisbon time)
              </span>
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