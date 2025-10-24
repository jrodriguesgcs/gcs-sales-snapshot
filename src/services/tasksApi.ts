import { User, LoadingProgress } from '../types/tasks';

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
  
  console.log('🌐 Fetching from proxy:', url);
  
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ API Error:', response.status, errorText);
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  console.log('✅ API Response received:', Object.keys(data));
  
  return data;
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
        // Build full name
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        // Extract only first part before " | " if it exists
        let cleanName = fullName;
        if (fullName.includes('|')) {
          cleanName = fullName.split('|')[0].trim();
        }
        
        // Fallback to email or ID if no name
        if (!cleanName) {
          cleanName = user.email || `User ${user.id}`;
        }
        
        console.log(`User ${user.id}: "${fullName}" -> "${cleanName}"`);
        userMap.set(user.id, cleanName);
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

  console.log('📊 Total users loaded:', userMap.size);

  onProgress({
    phase: 'users',
    message: `✓ Users loaded (${totalLoaded} users)`,
    current: totalLoaded,
    total: totalLoaded,
    percentage: 100,
  });

  return userMap;
}