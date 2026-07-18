// Mirror of backend/src/services/workflowService.js — keep the two in sync.
// The UI only ever offers transitions the server will accept.
export const allowedIssueTransitions = {
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

export const nextStatusOptions = (currentStatus) => allowedIssueTransitions[currentStatus] || [];

export const ISSUE_STATUSES = Object.keys(allowedIssueTransitions);
