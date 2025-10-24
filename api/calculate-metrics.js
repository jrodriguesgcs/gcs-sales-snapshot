class RateLimiter {
  constructor() {
    this.queue = [];
    this.activeRequests = 0;
    this.maxConcurrent = 20;
    this.lastRequestTime = 0;
    this.minInterval = 200; // 5 requests per second
  }

  async throttle(fn) {
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

  processQueue() {
    if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const OWNER_IDS = ['58', '74', '85', '89', '95', '96', '111', '117', '18'];

// Import the shared cache (we'll create a shared module)
let metricsCache = null;

async function fetchFromAPI(url, token, endpoint) {
  const fullUrl = `${url}${endpoint}`;
  
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Api-Token': token,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

function cleanOwnerName(fullName) {
  if (!fullName) return '';
  const parts = fullName.split('|');
  return parts[0].trim();
}

function isTaskOverdue(task) {
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

function isTaskFutureDueDate(task) {
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

async function calculateMetrics(apiUrl, apiToken) {
  const rateLimiter = new RateLimiter();
  
  console.log('🔵 [CRON] Starting metrics calculation...');
  const startTime = Date.now();
  
  // Calculate date 12 months ago
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const dateFilter = twelveMonthsAgo.toISOString().split('T')[0];
  
  console.log(`📅 [CRON] Filtering deals created after: ${dateFilter}`);
  
  // Step 1: Load users
  console.log('📥 [CRON] Loading users...');
  const userMap = new Map();
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const data = await rateLimiter.throttle(() =>
      fetchFromAPI(apiUrl, apiToken, `/api/3/users?limit=${limit}&offset=${offset}`)
    );

    if (data.users && data.users.length > 0) {
      data.users.forEach((user) => {
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

  console.log(`✅ [CRON] Users loaded: ${userMap.size}`);

  // Step 2: Load all deals for all owners in parallel
  console.log('📥 [CRON] Loading deals (last 12 months)...');
  const allDeals = [];

  const dealsByOwner = await Promise.all(
    OWNER_IDS.map(async (ownerId) => {
      const ownerDeals = [];
      let offset = 0;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        try {
          const endpoint = `/api/3/deals?filters[owner]=${ownerId}&filters[created_after]=${dateFilter}&limit=${limit}&offset=${offset}`;
          const data = await rateLimiter.throttle(() => fetchFromAPI(apiUrl, apiToken, endpoint));

          if (data.deals && data.deals.length > 0) {
            ownerDeals.push(...data.deals);
            offset += limit;
            hasMore = data.deals.length === limit;
          } else {
            hasMore = false;
          }
        } catch (error) {
          console.error(`[CRON] Error loading deals for owner ${ownerId}:`, error);
          hasMore = false;
        }
      }

      console.log(`✅ [CRON] Owner ${ownerId}: ${ownerDeals.length} deals`);
      return ownerDeals;
    })
  );

  dealsByOwner.forEach(deals => allDeals.push(...deals));
  console.log(`✅ [CRON] Total deals loaded: ${allDeals.length}`);

  // Step 3: Load tasks for all deals in parallel
  console.log('📥 [CRON] Loading tasks...');
  const allTasks = [];

  const batchSize = Math.ceil(allDeals.length / 20);
  const workers = Array.from({ length: 20 }, async (_, workerIndex) => {
    const startIndex = workerIndex * batchSize;
    const endIndex = Math.min(startIndex + batchSize, allDeals.length);
    const workerTasks = [];

    for (let i = startIndex; i < endIndex; i++) {
      const deal = allDeals[i];
      
      try {
        const endpoint = `/api/3/deals/${deal.id}/tasks`;
        const data = await rateLimiter.throttle(() => fetchFromAPI(apiUrl, apiToken, endpoint));

        if (data.dealTasks && data.dealTasks.length > 0) {
          const tasks = data.dealTasks.map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            duedate: task.duedate,
            dealId: deal.id,
          }));
          workerTasks.push(...tasks);
        }
      } catch (error) {
        console.error(`[CRON] Error loading tasks for deal ${deal.id}:`, error);
      }
    }

    return workerTasks;
  });

  const workerResults = await Promise.all(workers);
  workerResults.forEach(tasks => allTasks.push(...tasks));
  console.log(`✅ [CRON] Tasks loaded: ${allTasks.length}`);

  // Step 4: Calculate metrics
  console.log('📊 [CRON] Calculating metrics...');
  const metricsMap = new Map();

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

    const metric = metricsMap.get(ownerId);
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

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ [CRON] Metrics calculated in ${duration}s`);
  
  return { metrics, calculatedAt: new Date().toISOString() };
}

module.exports = async function handler(req, res) {
  // Verify this is a cron request (security)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('❌ [CRON] Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const AC_API_URL = process.env.AC_API_URL;
  const AC_API_TOKEN = process.env.AC_API_TOKEN;

  if (!AC_API_URL || !AC_API_TOKEN) {
    console.error('❌ [CRON] Missing environment variables');
    return res.status(500).json({ error: 'API configuration missing' });
  }

  try {
    console.log('🚀 [CRON] Starting scheduled metrics calculation...');
    const result = await calculateMetrics(AC_API_URL, AC_API_TOKEN);

    // Store in global cache (shared with task-metrics.js)
    global.metricsCache = result;
    
    console.log(`✅ [CRON] Metrics cached successfully at ${result.calculatedAt}`);

    return res.status(200).json({
      success: true,
      message: 'Metrics calculated and cached',
      calculatedAt: result.calculatedAt,
      metricsCount: result.metrics.length,
    });
  } catch (error) {
    console.error('❌ [CRON] Calculation error:', error);
    return res.status(500).json({ 
      error: 'Failed to calculate metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};