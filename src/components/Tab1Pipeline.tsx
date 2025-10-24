import { useState, useEffect, useMemo } from 'react';
import { Deal, PipelineMetrics, DateFilter } from '../types/deals';
import { loadDealsCSV } from '../services/csvParser';
import { parseCSVDate, formatDateDisplay, isDateInRange } from '../utils/dateUtils';
import { cleanOwnerName, shouldExcludeOwner } from '../utils/nameUtils';

export default function Tab1Pipeline() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedDeals = await loadDealsCSV();
      setDeals(loadedDeals);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique pipelines (excluding empty/null)
  const pipelines = useMemo(() => {
    const uniquePipelines = new Set<string>();
    deals.forEach(deal => {
      if (deal.Pipeline && deal.Pipeline.trim()) {
        uniquePipelines.add(deal.Pipeline.trim());
      }
    });
    return Array.from(uniquePipelines).sort();
  }, [deals]);

  // Set default pipeline when loaded
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipeline) {
      setSelectedPipeline(pipelines[0]);
    }
  }, [pipelines, selectedPipeline]);

  // Filter deals based on selections
  const filteredDeals = useMemo(() => {
    if (!selectedPipeline) return [];

    return deals.filter(deal => {
      // Must have DISTRIBUTION Time
      if (!deal['DISTRIBUTION Time']) return false;

      // Must match selected pipeline
      if (deal.Pipeline?.trim() !== selectedPipeline) return false;

      // Exclude operator
      if (shouldExcludeOwner(deal['Owner Name'])) return false;

      // Date filtering
      if (startDate && endDate) {
        const start = parseCSVDate(startDate);
        const end = parseCSVDate(endDate);
        if (!start || !end) return true; // If invalid dates, include all
        
        return isDateInRange(deal['DISTRIBUTION Time'], start, end);
      }

      return true;
    });
  }, [deals, selectedPipeline, startDate, endDate]);

  // Calculate metrics
  const metrics = useMemo((): PipelineMetrics[] => {
    const metricsMap = new Map<string, PipelineMetrics>();

    filteredDeals.forEach(deal => {
      const cleanName = cleanOwnerName(deal['Owner Name']);
      
      if (!metricsMap.has(cleanName)) {
        metricsMap.set(cleanName, {
          owner: cleanName,
          stages: {},
          lostBreakdown: {
            unreachable: 0,
            unresponsiveHighValue: 0,
          },
        });
      }

      const metric = metricsMap.get(cleanName)!;
      const stage = deal.Stage || 'Unknown';

      if (!metric.stages[stage]) {
        metric.stages[stage] = { open: 0, lost: 0 };
      }

      // Count open vs lost
      if (deal.Status === 'Open') {
        metric.stages[stage].open++;
      } else if (deal.Status === 'Lost') {
        metric.stages[stage].lost++;

        // Lost breakdown
        const lostReason = deal.LOST?.trim();
        if (lostReason === 'Unreachable') {
          metric.lostBreakdown.unreachable++;
        } else if (lostReason === 'Unresponsive High Value') {
          metric.lostBreakdown.unresponsiveHighValue++;
        }
      }
    });

    return Array.from(metricsMap.values()).sort((a, b) => 
      a.owner.localeCompare(b.owner)
    );
  }, [filteredDeals]);

  // Get all unique stages
  const allStages = useMemo(() => {
    const stages = new Set<string>();
    metrics.forEach(metric => {
      Object.keys(metric.stages).forEach(stage => stages.add(stage));
    });
    return Array.from(stages).sort();
  }, [metrics]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading deals data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start">
          <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-red-900 font-semibold mb-1">Failed to load deals data</h3>
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={loadData}
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
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pipeline Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pipeline
            </label>
            <select
              value={selectedPipeline}
              onChange={(e) => setSelectedPipeline(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {pipelines.map(pipeline => (
                <option key={pipeline} value={pipeline}>
                  {pipeline}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Distribution Date From (DD/MM/YYYY)
            </label>
            <input
              type="text"
              placeholder="21/10/2025"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Distribution Date To (DD/MM/YYYY)
            </label>
            <input
              type="text"
              placeholder="22/10/2025"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Showing {filteredDeals.length} deals in pipeline "{selectedPipeline}"
        </p>
      </div>

      {/* Metrics Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <div className="bg-white px-6 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Pipeline Metrics</h3>
          <p className="text-gray-600 text-sm mt-0.5">Open and Lost Deals by Owner and Stage</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10">
                  Deal Owner
                </th>
                {allStages.map(stage => (
                  <th key={stage} className="px-6 py-3 text-center text-sm font-semibold text-gray-700">
                    {stage}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metrics.map(metric => (
                <>
                  {/* Open Deals Row */}
                  <tr key={`${metric.owner}-open`} className="hover:bg-green-50 transition-colors">
                    <td className="px-6 py-4 sticky left-0 bg-white z-10">
                      <div className="text-sm font-medium text-gray-900">{metric.owner}</div>
                      <div className="text-sm text-green-600">Open Deals</div>
                    </td>
                    {allStages.map(stage => {
                      const stageData = metric.stages[stage];
                      return (
                        <td key={stage} className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                          {stageData?.open || 0}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Lost Deals Row */}
                  <tr key={`${metric.owner}-lost`} className="hover:bg-red-50 transition-colors">
                    <td className="px-6 py-4 sticky left-0 bg-white z-10">
                      <div className="text-sm font-medium text-gray-900">{metric.owner}</div>
                      <div className="text-sm text-red-600">Lost Deals</div>
                    </td>
                    {allStages.map(stage => {
                      const stageData = metric.stages[stage];
                      return (
                        <td key={stage} className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                          {stageData?.lost || 0}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Lost Breakdown Row */}
                  <tr key={`${metric.owner}-breakdown`} className="bg-yellow-50 hover:bg-yellow-100 transition-colors">
                    <td className="px-6 py-3 sticky left-0 bg-yellow-50 z-10">
                      <div className="text-sm font-medium text-gray-700 pl-4">↳ Lost (U + UHV)</div>
                    </td>
                    <td colSpan={allStages.length} className="px-6 py-3 text-center text-sm font-semibold text-gray-900">
                      {metric.lostBreakdown.unreachable} + {metric.lostBreakdown.unresponsiveHighValue}
                    </td>
                  </tr>
                </>
              ))}

              {metrics.length === 0 && (
                <tr>
                  <td colSpan={allStages.length + 1} className="px-6 py-8 text-center text-gray-500">
                    No deals found matching the selected filters
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