const NodeCache = require('node-cache');
const appCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const invalidateAssetCache = () => {
  const keys = appCache.keys();
  const assetKeys = keys.filter(key => key.startsWith('assets:'));
  assetKeys.forEach(key => appCache.del(key));
};

module.exports = {
  appCache,
  invalidateAssetCache,
};
