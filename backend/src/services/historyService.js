const AssetHistory = require('../models/AssetHistory');

const createHistoryEntry = async ({ asset, issue, actor, actorName, action, details }) => {
  return AssetHistory.create({
    asset,
    issue,
    actor,
    actorName,
    action,
    details,
  });
};

module.exports = { createHistoryEntry };
