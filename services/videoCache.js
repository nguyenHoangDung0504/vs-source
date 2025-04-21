const cache = new Map();
const cacheTTL = 60 * 1000;

function addToCache(filePath, buffer) {
    cache.set(filePath, {
        buffer,
        lastAccess: Date.now(),
    });
}

function getFromCache(filePath) {
    const data = cache.get(filePath);
    if (data) {
        data.lastAccess = Date.now();
        return data.buffer;
    }
    return null;
}

function cleanCache() {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.lastAccess > cacheTTL) {
            cache.delete(key);
        }
    }
}

module.exports = {
    addToCache,
    getFromCache,
    cleanCache,
    cacheTTL,
};
