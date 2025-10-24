import { LoadingProgress } from '../types/tasks';

class RateLimiter {
  private queue: Array<() => void> = [];
  private activeRequests = 0;
  private readonly maxConcurrent = 20;
  private lastRequestTime = 0;
  private readonly minInterval = 200; // 5 requests per second

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minInterval) {
          await new Promise(r => setTimeout(r, this.minInterval - timeSinceLastRequest));
        }

        this.lastRequestTime = Date.now();
        this.activeRequests++;

        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          this.processQueue();
        }
      };

      if (this.activeRequests < this.maxConcurrent) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private processQueue() {
    if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const rateLimiter = new RateLimiter();

async function fetchFromAPI(endpoint: string): Promise<any> {
  const url = `/api/ac-proxy?endpoint=${encodeURIComponent(endpoint)}`;
  
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ API Error:', response.status, errorText);
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

export interface Deal {
  id: string;
  title: string;
  owner: string;
  contact: string;
  organization: string;
}

export interface DealTask {
  id: string;
  title: string;
  status: string | number;
  duedate: string | null;
  dealId: string;
}

const OWNER_IDS = ['58', '74', '85', '89', '95', '96', '111', '117', '18'];

export async function fetchDealsAndTasks(
  onProgress: (progress: LoadingProgress) => void
): Promise<{ deals: Deal[]; tasks: DealTask[] }> {
  const allDeals: Deal[] = [];
  const allTasks: DealTask[] = [];

  // Step 1: Load all deals for all owners in parallel
  onProgress({
    phase: 'deals',
    message: 'Loading deals for all owners...',
    current: 0,
    total: OWNER_IDS.length,
    percentage: 0,
  });

  let completedOwners = 0;

  const dealsByOwner = await Promise.all(
    OWNER_IDS.map(async (ownerId) => {
      const ownerDeals: Deal[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        try {
          const endpoint = `/api/3/deals?filters[owner]=${ownerId}&limit=${limit}&offset=${offset}`;
          const data = await rateLimiter.throttle(() => fetchFromAPI(endpoint));

          if (data.deals && data.deals.length > 0) {
            ownerDeals.push(...data.deals);
            offset += limit;
            hasMore = data.deals.length === limit;
          } else {
            hasMore = false;
          }
        } catch (error) {
          console.error(`Error loading deals for owner ${ownerId}:`, error);
          hasMore = false;
        }
      }

      // Update progress after completing each owner
      completedOwners++;
      onProgress({
        phase: 'deals',
        message: `Loading deals: ${completedOwners}/${OWNER_IDS.length} owners completed`,
        current: completedOwners,
        total: OWNER_IDS.length,
        percentage: (completedOwners / OWNER_IDS.length) * 30,
      });

      return ownerDeals;
    })
  );

  dealsByOwner.forEach(deals => allDeals.push(...deals));

  console.log(`✅ Total deals loaded: ${allDeals.length}`);

  // Step 2: Load tasks for all deals in parallel with proper progress tracking
  onProgress({
    phase: 'tasks',
    message: 'Loading tasks for all deals...',
    current: 0,
    total: allDeals.length,
    percentage: 30,
  });

  let processedDeals = 0;
  const totalDeals = allDeals.length;

  // Process deals in batches using 20 workers
  const batchSize = Math.ceil(totalDeals / 20);
  const workers = Array.from({ length: 20 }, async (_, workerIndex) => {
    const startIndex = workerIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, totalDeals);
    const workerTasks: DealTask[] = [];

    for (let i = startIndex; i < endIndex; i++) {
      const deal = allDeals[i];
      
      try {
        const endpoint = `/api/3/deals/${deal.id}/tasks`;
        const data = await rateLimiter.throttle(() => fetchFromAPI(endpoint));

        if (data.dealTasks && data.dealTasks.length > 0) {
          const tasks = data.dealTasks.map((task: any) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            duedate: task.duedate,
            dealId: deal.id,
          }));
          workerTasks.push(...tasks);
        }

        // Increment processed counter
        processedDeals++;
        const current = processedDeals;

        // Update progress every 100 deals or at completion
        if (current % 100 === 0 || current === totalDeals) {
          onProgress({
            phase: 'tasks',
            message: `Loading tasks: ${current}/${totalDeals} deals processed`,
            current: current,
            total: totalDeals,
            percentage: 30 + (current / totalDeals) * 70,
          });
        }
      } catch (error) {
        console.error(`Error loading tasks for deal ${deal.id}:`, error);
        processedDeals++;
      }
    }

    return workerTasks;
  });

  const workerResults = await Promise.all(workers);
  workerResults.forEach(tasks => allTasks.push(...tasks));

  console.log(`✅ Total tasks loaded: ${allTasks.length}`);

  onProgress({
    phase: 'complete',
    message: `✓ Loaded ${allDeals.length} deals and ${allTasks.length} tasks`,
    current: allDeals.length,
    total: allDeals.length,
    percentage: 100,
  });

  return { deals: allDeals, tasks: allTasks };
}