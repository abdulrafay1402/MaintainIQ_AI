const NodeCache = require('node-cache');

// On serverless (Vercel) each lambda instance would hold its own private copy of this
// cache, so different requests could see lists that are minutes apart ("disappearing"
// assets). Caching is therefore disabled there and only used for local/long-lived servers.
const enabled = !process.env.VERCEL;
// useClones must stay off: cloning hydrated Mongoose documents fires their
// internal setters and crashes ("reading 'populated'"). Only cache plain
// (.lean()) objects and never mutate what comes out of the cache.
const store = new NodeCache({ stdTTL: 60, checkperiod: 30, useClones: false });

const appCache = {
  get: (key) => (enabled ? store.get(key) : undefined),
  set: (key, value, ttl) => (enabled ? store.set(key, value, ttl) : false),
  keys: () => (enabled ? store.keys() : []),
  del: (key) => (enabled ? store.del(key) : 0),
};

const invalidateAssetCache = () => {
  appCache
    .keys()
    .filter((key) => key.startsWith('assets:'))
    .forEach((key) => appCache.del(key));
};

module.exports = {
  appCache,
  invalidateAssetCache,
};
