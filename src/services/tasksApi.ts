import { Task, User, LoadingProgress } from '../types/tasks';

const API_BASE = import.meta.env.VITE_AC_API_URL || '';
const API_TOKEN = import.meta.env.VITE_AC_API_TOKEN || '';

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
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchUsers(
  onProgress: (progress: LoadingProgress) => void
): Promise<Map<string, string>> {
  onProgress({
    phase: 'users',
    message: 'Loading users...',
    current: 0,
    total: 1,
    percentage: 0,
  });

  const userMap = new Map<string, string>();
  let offset = 0;
  const limit = 100;
  let hasMore = true;
  let totalLoaded = 0;

  while (hasMore) {
    const data = await rateLimiter.throttle(() =>
      fetchFromAPI(`/api/3/users?limit=${limit}&offset=${offset}`)
    );

    if (data.users && data.users.length > 0) {
      data.users.forEach((user: User) => {
        const fullName = `${user.firstName} ${user.lastName}`.trim();
        // Extract only first part before " | "
        const cleanName = fullName.split('|')[0].trim();
        userMap.set(user.id, cleanName || `User ${user.id}`);
      });
      
      totalLoaded += data.users.length;
      offset += limit;
      hasMore = data.users.length === limit;
      
      onProgress({
        phase: 'users',
        message: `Loaded ${totalLoaded} users...`,
        current: totalLoaded,
        total: data.meta?.total || totalLoaded,
        percentage: 50,
      });
    } else {
      hasMore = false;
    }
  }

  onProgress({
    phase: 'users',
    message: `✓ Users loaded (${totalLoaded} users)`,
    current: totalLoaded,
    total: totalLoaded,
    percentage: 100,
  });

  return userMap;
}

export async function fetchTasks(
  dateFilter: 'last7days' | 'last30days' | 'alltime',
  onProgress: (progress: LoadingProgress) => void,
  maxTasks: number = 1000
): Promise<Task[]> {
  const tasks: Task[] = [];
  
  // Calculate date filter
  let dateParams = '';
  if (dateFilter !== 'alltime') {
    const daysAgo = dateFilter === 'last7days' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    dateParams = `&filters[cdate_after]=${startDate.toISOString()}`;
  }

  // Calculate number of workers and tasks per worker
  const limit = 100; // API max
  const totalBatches = Math.ceil(maxTasks / limit);
  const batchesPerWorker = Math.ceil(totalBatches / 20);

  onProgress({
    phase: 'tasks',
    message: `⏳ Fetching tasks step 1/${totalBatches}...`,
    current: 0,
    total: maxTasks,
    percentage: 0,
  });

  // Create 20 workers
  const workers = Array.from({ length: 20 }, async (_, workerIndex) => {
    const workerTasks: Task[] = [];
    const startBatch = workerIndex * batchesPerWorker;
    const endBatch = Math.min(startBatch + batchesPerWorker, totalBatches);

    for (let batchIndex = startBatch; batchIndex < endBatch; batchIndex++) {
      const offset = batchIndex * limit;
      
      try {
        const endpoint = `/api/3/dealTasks?limit=${limit}&offset=${offset}${dateParams}&orders[cdate]=DESC`;
        const data = await rateLimiter.throttle(() => fetchFromAPI(endpoint));

        if (data.dealTasks && data.dealTasks.length > 0) {
          workerTasks.push(...data.dealTasks);
          
          const currentTotal = tasks.length + workerTasks.length;
          onProgress({
            phase: 'tasks',
            message: `⏳ Fetching tasks step ${batchIndex + 1}/${totalBatches}...`,
            current: currentTotal,
            total: maxTasks,
            percentage: Math.min(100, (currentTotal / maxTasks) * 100),
          });
        }

        // Stop if we got less than limit (no more tasks)
        if (data.dealTasks.length < limit) {
          break;
        }
      } catch (error) {
        console.error(`Worker ${workerIndex} error at batch ${batchIndex}:`, error);
        break;
      }
    }

    return workerTasks;
  });

  const workerResults = await Promise.all(workers);
  tasks.push(...workerResults.flat());

  // Sort by creation date (newest first)
  tasks.sort((a, b) => new Date(b.cdate).getTime() - new Date(a.cdate).getTime());

  onProgress({
    phase: 'tasks',
    message: `⏳ Tasks loading: ${tasks.length}/${maxTasks}`,
    current: tasks.length,
    total: maxTasks,
    percentage: 100,
  });

  return tasks;
}