const cache = require('../lib/cache');

async function invalidateUserCache(userId) {
    await Promise.allSettled([
        cache.del(`stats:${userId}`),
        cache.del(`velocity:${userId}`),
        cache.del(`overview:${userId}`),
        cache.del(`topic-stats:${userId}`),
        cache.del(`platform-stats:${userId}`),
        cache.del(`revision-queue:${userId}`),
        cache.del(`achievements:${userId}`),
        cache.del(`insights:${userId}`),
        cache.delByPrefix(`activity:${userId}:`),
        cache.delByPrefix(`problems:${userId}:`),
    ]);
}

module.exports = {
    invalidateUserCache,
    cache,
};
