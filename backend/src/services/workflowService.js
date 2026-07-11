const assetStatusByIssueStatus = {
  Reported: 'Issue Reported',
  Assigned: 'Issue Reported',
  'Inspection Started': 'Under Inspection',
  'Maintenance In Progress': 'Under Maintenance',
  'Waiting for Parts': 'Under Maintenance',
  Resolved: 'Operational',
  Closed: 'Operational',
  Reopened: 'Issue Reported',
};

const allowedIssueTransitions = {
  Reported: ['Assigned', 'Rejected', 'Cancelled', 'Reopened'],
  Assigned: ['Inspection Started', 'Rejected', 'Reopened'],
  'Inspection Started': ['Maintenance In Progress', 'Waiting for Parts', 'Reopened'],
  'Maintenance In Progress': ['Waiting for Parts', 'Resolved', 'Reopened'],
  'Waiting for Parts': ['Maintenance In Progress', 'Resolved', 'Reopened'],
  Resolved: ['Verified', 'Closed', 'Reopened'],
  Verified: ['Closed', 'Reopened'],
  Closed: ['Reopened'],
  Reopened: ['Assigned', 'Inspection Started', 'Maintenance In Progress', 'Waiting for Parts', 'Resolved'],
  Rejected: [],
  Cancelled: [],
};

const canTransitionIssue = (currentStatus, nextStatus) => {
  const allowed = allowedIssueTransitions[currentStatus] || [];
  return allowed.includes(nextStatus);
};

const nextAssetStatusForIssueStatus = (issueStatus, overrideStatus) => {
  if (overrideStatus) {
    return overrideStatus;
  }

  return assetStatusByIssueStatus[issueStatus] || 'Operational';
};

module.exports = {
  canTransitionIssue,
  nextAssetStatusForIssueStatus,
};
