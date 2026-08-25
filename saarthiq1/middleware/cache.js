// middleware/cache.js
// In-memory caching for filter options

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL for filter options

class CacheService {
  constructor() {
    this.cache = cache;
    this.intervals = new Map();
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  generateKey(prefix, data) {
    return `${prefix}:${JSON.stringify(data)}`;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  set(key, value, ttl = CACHE_TTL) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  deleteByPrefix(prefix) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  clear() {
    this.cache.clear();
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Singleton instance
const cacheService = new CacheService();

// Middleware to cache responses
export const cacheResponse = (prefix, ttl) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const key = cacheService.generateKey(prefix, {
      path: req.path,
      query: req.query
    });

    const cached = cacheService.get(key);
    if (cached) {
      console.log(`📦 Cache HIT: ${key}`);
      return res.json(cached);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = (data) => {
      cacheService.set(key, data, ttl);
      console.log(`💾 Cache SET: ${key}`);
      return originalJson.call(res, data);
    };

    next();
  };
};

// Invalidate cache when profiles are updated
export const invalidateProfileCache = () => {
  cacheService.deleteByPrefix('filters:options');
  cacheService.deleteByPrefix('filters:cascading');
  console.log('🗑️  Profile cache invalidated');
};

export { cacheService };
export default cacheService;
