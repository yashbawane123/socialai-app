class InMemoryCache {
  constructor() {
    this.store = new Map();
  }

  /**
   * Set a value in the cache with an optional TTL (in milliseconds)
   * @param {string} key 
   * @param {any} value 
   * @param {number} ttlMs 
   */
  set(key, value, ttlMs = 300000) { // Default TTL is 5 minutes
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, {
      value,
      expiresAt
    });
  }

  /**
   * Get a value from the cache
   * @param {string} key 
   * @returns {any|null}
   */
  get(key) {
    const cached = this.store.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.store.delete(key); // Evict expired key
      return null;
    }

    return cached.value;
  }

  /**
   * Delete a key from the cache
   * @param {string} key 
   */
  del(key) {
    this.store.delete(key);
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key 
   * @returns {boolean}
   */
  has(key) {
    const cached = this.store.get(key);
    if (!cached) return false;

    if (Date.now() > cached.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all items from the cache
   */
  clear() {
    this.store.clear();
  }
}

const cache = new InMemoryCache();
export default cache;
