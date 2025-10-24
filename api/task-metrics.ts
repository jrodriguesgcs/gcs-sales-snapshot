import { LoadingProgress } from '../src/types/tasks';

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

interface Deal {
  id: string;
  title: string;
  owner: string;
  contact: string;
  organization: string;
}

interface DealTask {
  id: string;
  title: string;
  status: string | number;
  duedate: string | null;
  dealId: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface TaskMetrics {
  owner: string;
  ownerId: string;
  total: number;
  completed: number;
  overdue: number;
  openFutureDueDate: number;
  openNoDueDate: number;
}

const OWNER_IDS = ['58', '74', '85', '89', '95', '96', '111', '117', '18'];

// Simple in-memory cache
let cachedData: { metrics: TaskMetrics[]; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

async function fetchFromAPI(url: string, token: string, endpoint: string): Promise<any> {
  const fullUrl = `${url}${endpoint}`;
  
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Api-Token': token,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

function cleanOwnerName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.split('|');
  return parts[0].trim();
}

function isTaskOverdue(task: { status: string | number; duedate: string | null }): boolean {
  const isComplete = task.status === 1 || task.status === '1';
  if (isComplete) return false;
  if (!task.duedate) return false;
  
  try {
    const dueDate = new Date(task.duedate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  } catch {
    return false;
  }
}

function isTaskFutureDueDate(task: { status: string | number; duedate: string | null }): boolean {
  const isComplete = task.status === 1 || task.status === '1';
  if (isComplete) return false;
  if (!task.duedate) return false;
  
  try {
    const dueDate = new Date(task.duedate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate >= today;
  } catch {
    return false;
  }
}

async function calculateMetrics(apiUrl: string, apiToken: string): Promise<TaskMetrics[]> {
  console.log('🔵 Starting metrics calculation...');
  
  // Step 1: Load users
  console.log('📥 Loading users...');
  const userMap = new Map<string, string>();
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const data = await rateLimiter.throttle(() =>
      fetchFromAPI(apiUrl, apiToken, `/api/3/users?limit=${limit}&offset=${offset}`)
    );

    if (data.users && data.users.length > 0) {
      data.users.forEach((user: User) => {
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        let cleanName = fullName;
        if (fullName.includes('|')) {
          cleanName = fullName.split('|')[0].trim();
        }
        if (!cleanName) {
          cleanName = user.email || `User ${user.id}`;
        }
        userMap.set(user.id, cleanName);
      });
      
      offset += limit;
      hasMore = data.users.length === limit;
    } else {
      hasMore = false;
    }
  }

  console.log(`✅ Users loaded: ${userMap.size}`);

  // Step 2: Load all deals for all owners in parallel
  console.log('📥 Loading deals...');
  const allDeals: Deal[] = [];

  const dealsByOwner = await Promise.all(
    OWNER_IDS.map(async (ownerId) => {
      const ownerDeals: Deal[] = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        try {
          const endpoint = `/api/3/deals?filters[owner]=${ownerId}&limit=${limit}&offset=${offset}`;
          const data = await rateLimiter.throttle(() => fetchFromAPI(apiUrl, apiToken, endpoint));

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

      return ownerDeals;
    })
  );

  dealsByOwner.forEach(deals => allDeals.push(...deals));
  console.log(`✅ Deals loaded: ${allDeals.length}`);

  // Step 3: Load tasks for all deals in parallel
  console.log('📥 Loading tasks...');
  const allTasks: DealTask[] = [];

  const batchSize = Math.ceil(allDeals.length / 20);
  const workers = Array.from({ length: 20 }, async (_, workerIndex) => {
    const startIndex = workerIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, allDeals.length);
    const workerTasks: DealTask[] = [];

    for (let i = startIndex; i < endIndex; i++) {
      const deal = allDeals[i];
      
      try {
        const endpoint = `/api/3/deals/${deal.id}/tasks`;
        const data = await rateLimiter.throttle(() => fetchFromAPI(apiUrl, apiToken, endpoint));

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
      } catch (error) {
        console.error(`Error loading tasks for deal ${deal.id}:`, error);
      }
    }

    return workerTasks;
  });

  const workerResults = await Promise.all(workers);
  workerResults.forEach(tasks => allTasks.push(...tasks));
  console.log(`✅ Tasks loaded: ${allTasks.length}`);

  // Step 4: Calculate metrics
  console.log('📊 Calculating metrics...');
  const metricsMap = new Map<string, TaskMetrics>();

  allDeals.forEach(deal => {
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
    const dealTasks = allTasks.filter(task => task.dealId === deal.id);

    dealTasks.forEach(task => {
      metric.total++;

      const isCompleted = task.status === 1 || task.status === '1';

      if (isCompleted) {
        metric.completed++;
      } else {
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

  const metrics = Array.from(metricsMap.values()).sort((a, b) =>
    a.owner.localeCompare(b.owner)
  );

  console.log('✅ Metrics calculated');
  return metrics;
}

const handler = async (req: any, res: any) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const AC_API_URL = process.env.AC_API_URL;
  const AC_API_TOKEN = process.env.AC_API_TOKEN;

  if (!AC_API_URL || !AC_API_TOKEN) {
    return res.status(500).json({ error: 'API configuration missing' });
  }

  try {
    // Check cache first
    const now = Date.now();
    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      console.log('✅ Returning cached data');
      return res.status(200).json({
        metrics: cachedData.metrics,
        cached: true,
        cachedAt: new Date(cachedData.timestamp).toISOString(),
      });
    }

    // Calculate fresh metrics
    console.log('🔄 Calculating fresh metrics...');
    const metrics = await calculateMetrics(AC_API_URL, AC_API_TOKEN);

    // Cache the result
    cachedData = {
      metrics,
      timestamp: now,
    };

    return res.status(200).json({
      metrics,
      cached: false,
      calculatedAt: new Date(now).toISOString(),
    });
  } catch (error) {
    console.error('Task metrics calculation error:', error);
    return res.status(500).json({ 
      error: 'Failed to calculate task metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

module.exports = handler;