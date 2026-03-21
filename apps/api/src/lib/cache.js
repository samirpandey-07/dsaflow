/**
 * apps/api/src/lib/cache.js
 * 
 * Redis caching helper using ioredis.
 * Gracefully no-ops if REDIS_URL is not configured.
 * This ensures the API never crashes in dev without a Redis server.
 */
const Redis = require('ioredis');

let client = null;

if (process.env.REDIS_URL) {
    try {
        client = new Redis(process.env.REDIS_URL, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
        });
        client.on('error', (err) => {
            console.warn('[Cache] Redis connection error (non-fatal):', err.message);
            client = null; // Fall back to no-cache mode
        });
        console.log('[Cache] Redis connected.');
    } catch (e) {
        console.warn('[Cache] Failed to initialize Redis, running without cache.');
        client = null;
    }
} else {
    console.log('[Cache] REDIS_URL not set — running without cache.');
}

const DEFAULTS = {
    stats: 30,      // 30 seconds
    velocity: 30,   // 30 seconds
    problems: 10,   // 10 seconds
};

/**
 * Get a cached value. Returns null on cache miss or if Redis is unavailable.
 * @param {string} key
 */
async function get(key) {
    if (!client) return null;
    try {
        const val = await client.get(key);
        return val ? JSON.parse(val) : null;
    } catch {
        return null;
    }
}

/**
 * Set a cached value with TTL.
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 */
async function set(key, value, ttlSeconds = 30) {
    if (!client) return;
    try {
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
        // Silent fail — cache is best-effort
    }
}

/**
 * Delete a cached key (use on write operations to invalidate stale data).
 * @param {string} key
 */
async function del(key) {
    if (!client) return;
    try {
        await client.del(key);
    } catch {
        // Silent fail
    }
}

async function delByPrefix(prefix) {
    if (!client) return;
    try {
        const stream = client.scanStream({ match: `${prefix}*`, count: 100 });
        for await (const keys of stream) {
            if (keys.length) {
                await client.del(...keys);
            }
        }
    } catch {
        // Silent fail
    }
}

module.exports = { get, set, del, delByPrefix, DEFAULTS };
