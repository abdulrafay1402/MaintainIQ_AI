const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;
let User;
let Asset;
let Issue;

const buildAuthHeader = (token) => ({ Authorization: `Bearer ${token}` });

test.before(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
  process.env.NODE_ENV = 'test';

  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri('maintainiq-test');

  app = require('../src/app');
  User = require('../src/models/User');
  Asset = require('../src/models/Asset');
  Issue = require('../src/models/Issue');

  await mongoose.connect(process.env.MONGODB_URI);
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.afterEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

test('maintainiq backend core flows work end to end', async () => {
  const agent = request(app);

  const adminRegister = await agent.post('/api/auth/register').send({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'Admin1234',
    role: 'admin',
  });
  assert.equal(adminRegister.status, 201);
  assert.equal(adminRegister.body.user.role, 'admin');
  const adminToken = adminRegister.body.token;

  const technicianRegister = await agent.post('/api/auth/register').send({
    name: 'Technician User',
    email: 'tech@example.com',
    password: 'Tech1234',
    role: 'technician',
  });
  assert.equal(technicianRegister.status, 201);
  const technicianToken = technicianRegister.body.token;

  const authMe = await agent.get('/api/auth/me').set(buildAuthHeader(adminToken));
  assert.equal(authMe.status, 200);
  assert.equal(authMe.body.user.email, 'admin@example.com');

  const unauthorizedAssets = await agent.get('/api/assets');
  assert.equal(unauthorizedAssets.status, 401);

  const createdAsset = await agent.post('/api/assets').set(buildAuthHeader(adminToken)).send({
    name: 'Classroom Projector 01',
    code: 'AST-PROJ-001',
    category: 'Projector',
    location: 'Room 12',
    condition: 'Good',
    status: 'Operational',
    notes: 'Mounted near whiteboard',
  });
  assert.equal(createdAsset.status, 201);
  assert.equal(createdAsset.body.asset.code, 'AST-PROJ-001');
  assert.ok(createdAsset.body.qrCodeDataUrl.startsWith('data:image/png;base64,'));

  const duplicateAsset = await agent.post('/api/assets').set(buildAuthHeader(adminToken)).send({
    name: 'Duplicate Projector',
    code: 'AST-PROJ-001',
    category: 'Projector',
    location: 'Room 13',
  });
  assert.equal(duplicateAsset.status, 400);

  const assetList = await agent.get('/api/assets').set(buildAuthHeader(adminToken));
  assert.equal(assetList.status, 200);
  assert.equal(assetList.body.assets.length, 1);

  const assetId = createdAsset.body.asset._id;
  const assetDetails = await agent.get(`/api/assets/${assetId}`).set(buildAuthHeader(adminToken));
  assert.equal(assetDetails.status, 200);
  assert.equal(assetDetails.body.asset.name, 'Classroom Projector 01');

  const assetQr = await agent.get(`/api/assets/${assetId}/qr`).set(buildAuthHeader(adminToken));
  assert.equal(assetQr.status, 200);
  assert.ok(assetQr.body.publicUrl.includes('/public/assets/AST-PROJ-001'));

  const publicAsset = await agent.get('/api/assets/public/AST-PROJ-001');
  assert.equal(publicAsset.status, 200);
  assert.equal(publicAsset.body.asset.code, 'AST-PROJ-001');

  const publicAssetQr = await agent.get('/api/assets/public/AST-PROJ-001/qr');
  assert.equal(publicAssetQr.status, 200);
  assert.ok(publicAssetQr.body.qrCodeDataUrl.startsWith('data:image/png;base64,'));

  const triage = await agent.post('/api/issues/triage').set(buildAuthHeader(adminToken)).send({
    assetCode: 'AST-PROJ-001',
    complaint: 'Display flickering and HDMI not detected',
  });
  assert.equal(triage.status, 200);
  assert.equal(triage.body.suggestion.priority, 'High');

  const publicIssue = await agent.post('/api/issues/public/AST-PROJ-001/report').send({
    title: 'Display Connectivity Issue',
    description: 'The projector display is flickering and HDMI is not working.',
    priority: 'High',
    category: 'Display',
    reporterName: 'Student One',
    reporterEmail: 'student@example.com',
    aiSuggestion: triage.body.suggestion,
  });
  assert.equal(publicIssue.status, 201);
  assert.equal(publicIssue.body.issue.status, 'Reported');

  const issueListAfterPublicReport = await agent.get('/api/issues').set(buildAuthHeader(adminToken));
  assert.equal(issueListAfterPublicReport.status, 200);
  assert.equal(issueListAfterPublicReport.body.issues.length, 1);

  const issueId = publicIssue.body.issue._id;

  const adminOnlyUsers = await agent.get('/api/users').set(buildAuthHeader(technicianToken));
  assert.equal(adminOnlyUsers.status, 403);

  const technicians = await agent.get('/api/users/technicians').set(buildAuthHeader(adminToken));
  assert.equal(technicians.status, 200);
  assert.equal(technicians.body.technicians.length, 1);

  const assignIssue = await agent.patch(`/api/issues/${issueId}/assign`).set(buildAuthHeader(adminToken)).send({
    technicianId: technicianRegister.body.user.id,
  });
  assert.equal(assignIssue.status, 200);
  assert.equal(assignIssue.body.issue.status, 'Assigned');

  const issueAfterAssign = await agent.get(`/api/issues/${issueId}`).set(buildAuthHeader(adminToken));
  assert.equal(issueAfterAssign.status, 200);
  assert.equal(issueAfterAssign.body.issue.assignedTechnician._id.toString(), technicianRegister.body.user.id);

  const technicianUpdate = await agent.patch(`/api/issues/${issueId}/status`).set(buildAuthHeader(technicianToken)).send({
    status: 'Inspection Started',
    note: 'Initial inspection started on-site',
  });
  assert.equal(technicianUpdate.status, 200);
  assert.equal(technicianUpdate.body.issue.status, 'Inspection Started');

  const maintenanceStart = await agent.patch(`/api/issues/${issueId}/status`).set(buildAuthHeader(technicianToken)).send({
    status: 'Maintenance In Progress',
    note: 'Replacing HDMI cable',
  });
  assert.equal(maintenanceStart.status, 200);
  assert.equal(maintenanceStart.body.issue.status, 'Maintenance In Progress');

  const maintenanceRecord = await agent.post(`/api/issues/${issueId}/maintenance`).set(buildAuthHeader(technicianToken)).send({
    notes: 'Replaced damaged HDMI cable and verified display output.',
    partsUsed: [{ name: 'HDMI cable', quantity: 1, cost: 15 }],
    cost: 15,
    startedAt: '2026-07-11T09:00:00.000Z',
    completedAt: '2026-07-11T10:00:00.000Z',
    nextServiceDate: '2026-08-11',
    evidence: ['https://example.com/repaired-image.jpg'],
  });
  assert.equal(maintenanceRecord.status, 201);
  assert.equal(maintenanceRecord.body.issue.status, 'Resolved');

  const resolvedIssue = await agent.get(`/api/issues/${issueId}`).set(buildAuthHeader(adminToken));
  assert.equal(resolvedIssue.status, 200);
  assert.equal(resolvedIssue.body.issue.status, 'Resolved');

  const history = await agent.get(`/api/history/asset/${assetId}`).set(buildAuthHeader(adminToken));
  assert.equal(history.status, 200);
  assert.ok(history.body.history.length >= 4);

  const updatedAsset = await agent.get(`/api/assets/${assetId}`).set(buildAuthHeader(adminToken));
  assert.equal(updatedAsset.status, 200);
  assert.equal(updatedAsset.body.asset.status, 'Operational');
  assert.ok(updatedAsset.body.asset.nextServiceDate);

  const forbiddenMaintenance = await agent.post(`/api/issues/${issueId}/maintenance`).set(buildAuthHeader(adminToken)).send({
    notes: 'Attempt by admin after resolution',
    completedAt: '2026-07-11T11:00:00.000Z',
  });
  assert.equal(forbiddenMaintenance.status, 201);

  const staleHistory = await agent.get(`/api/history/asset/${assetId}`).set(buildAuthHeader(technicianToken));
  assert.equal(staleHistory.status, 200);

  const invalidTransition = await agent.patch(`/api/issues/${issueId}/status`).set(buildAuthHeader(technicianToken)).send({
    status: 'Closed',
    note: 'Closing after resolution',
  });
  assert.equal(invalidTransition.status, 200);

  const publicAssetsList = await agent.get('/api/assets/public/AST-PROJ-001');
  assert.equal(publicAssetsList.status, 200);
  assert.equal(publicAssetsList.body.recentIssues[0].issueNumber, publicIssue.body.issue.issueNumber);

  const adminOnlyUserList = await agent.get('/api/users').set(buildAuthHeader(adminToken));
  assert.equal(adminOnlyUserList.status, 200);
  assert.equal(adminOnlyUserList.body.users.length, 2);

  const invalidAuth = await agent.get('/api/auth/me');
  assert.equal(invalidAuth.status, 401);

  assert.equal(await User.countDocuments(), 2);
  assert.equal(await Asset.countDocuments(), 1);
  assert.equal(await Issue.countDocuments(), 1);
});
