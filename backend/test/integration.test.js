const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../src/app');
const User = require('../src/models/User');
const Asset = require('../src/models/Asset');
const Issue = require('../src/models/Issue');
const AssetHistory = require('../src/models/AssetHistory');
const MaintenanceRecord = require('../src/models/MaintenanceRecord');

const originalMethods = [];
let store;

const restoreStubs = () => {
  while (originalMethods.length) {
    const [objectRef, key, originalValue] = originalMethods.pop();
    objectRef[key] = originalValue;
  }
};

const stub = (objectRef, key, implementation) => {
  originalMethods.push([objectRef, key, objectRef[key]]);
  objectRef[key] = implementation;
};

const chainResult = (result) => {
  const chain = {
    select() {
      return chain;
    },
    populate() {
      return chain;
    },
    sort() {
      return chain;
    },
    limit() {
      return chain;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(result).catch(reject);
    },
  };

  return chain;
};

const createUser = ({ name, email, password, role, studentId }) => {
  const user = {
    _id: new mongoose.Types.ObjectId().toString(),
    name,
    email,
    password,
    role,
    studentId,
    isActive: true,
  };

  store.users.push(user);
  return user;
};

const createAsset = (data) => {
  const asset = {
    _id: new mongoose.Types.ObjectId().toString(),
    name: data.name,
    code: data.code,
    category: data.category,
    location: data.location,
    condition: data.condition || 'Good',
    status: data.status || 'Operational',
    building: data.building,
    floor: data.floor,
    roomNumber: data.roomNumber,
    vendor: data.vendor,
    modelNumber: data.modelNumber,
    warrantyDate: data.warrantyDate,
    images: data.images || [],
    maintenanceFrequencyDays: data.maintenanceFrequencyDays,
    assignedTechnician: data.assignedTechnician || null,
    lastServiceDate: data.lastServiceDate || null,
    nextServiceDate: data.nextServiceDate || null,
    notes: data.notes || '',
    async save() {
      const index = store.assets.findIndex((entry) => entry._id === asset._id);
      if (index >= 0) {
        store.assets[index] = asset;
      }
      return asset;
    },
  };

  store.assets.push(asset);
  return asset;
};

const createIssue = (data) => {
  const issue = {
    _id: new mongoose.Types.ObjectId().toString(),
    issueNumber: data.issueNumber,
    asset: data.asset,
    assetCode: data.assetCode,
    title: data.title,
    description: data.description,
    category: data.category,
    priority: data.priority || 'Medium',
    reporterName: data.reporterName,
    reporterEmail: data.reporterEmail,
    reporterId: data.reporterId,
    status: data.status || 'Reported',
    rejectedReason: data.rejectedReason,
    acceptedAt: data.acceptedAt,
    verifiedBy: data.verifiedBy,
    verifiedAt: data.verifiedAt,
    timeline: data.timeline || [],
    assignedTechnician: data.assignedTechnician || null,
    aiSuggestion: data.aiSuggestion,
    evidence: data.evidence || [],
    maintenanceNotes: data.maintenanceNotes || '',
    partsUsed: data.partsUsed || [],
    maintenanceCost: data.maintenanceCost || 0,
    resolvedAt: data.resolvedAt,
    closedAt: data.closedAt,
    async save() {
      const index = store.issues.findIndex((entry) => entry._id === issue._id);
      if (index >= 0) {
        store.issues[index] = issue;
      } else {
        store.issues.push(issue);
      }
      return issue;
    },
  };

  store.issues.push(issue);
  return issue;
};

const createAssetHistory = (data) => {
  const history = {
    _id: new mongoose.Types.ObjectId().toString(),
    asset: data.asset,
    issue: data.issue,
    actor: data.actor,
    actorName: data.actorName,
    action: data.action,
    details: data.details || '',
    createdAt: new Date(),
  };
  store.history.push(history);
  return history;
};

const createMaintenanceRecord = (data) => {
  const record = {
    _id: new mongoose.Types.ObjectId().toString(),
    ...data,
  };
  store.maintenance.push(record);
  return record;
};

const seedStore = async () => {
  store = {
    users: [],
    assets: [],
    issues: [],
    history: [],
    maintenance: [],
  };

  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const techPassword = await bcrypt.hash('Tech@123', 10);
  const studentPassword = await bcrypt.hash('Student@123', 10);

  const admin = createUser({ name: 'Admin User', email: 'admin@test.local', password: adminPassword, role: 'admin' });
  const technician = createUser({ name: 'Tech User', email: 'tech@test.local', password: techPassword, role: 'technician' });
  const student = createUser({ name: 'Student User', email: 'student@test.local', password: studentPassword, role: 'student', studentId: 'ST-001' });

  const asset = createAsset({
    name: 'Classroom Projector 01',
    code: 'AST-PROJ-001',
    category: 'Projector',
    location: 'Room 12',
    condition: 'Good',
    status: 'Operational',
    assignedTechnician: technician._id,
  });

  createAssetHistory({
    asset: asset._id,
    actor: admin._id,
    actorName: admin.name,
    action: 'Asset created',
    details: 'Seed asset for backend verification',
  });

  return { admin, technician, student, asset };
};

const setupStubs = () => {
  stub(User, 'findOne', (query = {}) => {
    const found = store.users.find((user) => {
      if (query.email) {
        return user.email === query.email;
      }
      return false;
    }) || null;

    if (!found) {
      return chainResult(null);
    }

    return chainResult(found);
  });

  stub(User, 'findById', (id) => {
    const found = store.users.find((user) => user._id === String(id)) || null;
    return chainResult(found);
  });

  stub(User, 'find', (query = {}) => {
    let results = [...store.users];
    if (query.role) {
      results = results.filter((user) => user.role === query.role);
    }
    if (typeof query.isActive === 'boolean') {
      results = results.filter((user) => user.isActive === query.isActive);
    }
    return chainResult(results);
  });

  stub(User, 'create', async (data) => {
    const user = createUser({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role || 'student',
      studentId: data.studentId,
    });
    return user;
  });

  stub(Asset, 'findOne', (query = {}) => {
    const found = store.assets.find((asset) => {
      if (query.code) {
        return asset.code === query.code;
      }
      if (query._id) {
        return asset._id === String(query._id);
      }
      return false;
    }) || null;
    return chainResult(found);
  });

  stub(Asset, 'findById', (id) => {
    const found = store.assets.find((asset) => asset._id === String(id)) || null;
    return chainResult(found);
  });

  stub(Asset, 'find', (query = {}) => {
    let results = [...store.assets];
    if (query.status) {
      results = results.filter((asset) => asset.status === query.status);
    }
    if (query.category) {
      results = results.filter((asset) => asset.category === query.category);
    }
    if (query.location) {
      results = results.filter((asset) => asset.location === query.location);
    }
    if (query.$or) {
      results = results.filter((asset) => query.$or.some((clause) => {
        const [field] = Object.keys(clause);
        const rule = clause[field];
        if (rule instanceof RegExp) {
          return rule.test(asset[field] || '');
        }
        if (rule && rule.$regex) {
          return new RegExp(rule.$regex, rule.$options || '').test(asset[field] || '');
        }
        return String(asset[field] || '').toLowerCase().includes(String(rule).toLowerCase());
      }));
    }
    return chainResult(results);
  });

  stub(Asset, 'create', async (data) => createAsset(data));

  stub(Issue, 'findOne', (query = {}) => {
    const found = store.issues.find((issue) => {
      if (query.issueNumber) {
        return issue.issueNumber === query.issueNumber;
      }
      return false;
    }) || null;
    return chainResult(found);
  });

  stub(Issue, 'findById', (id) => {
    const found = store.issues.find((issue) => issue._id === String(id)) || null;
    return chainResult(found);
  });

  stub(Issue, 'find', (query = {}) => {
    let results = [...store.issues];

    if (query.assignedTechnician) {
      results = results.filter((issue) => String(issue.assignedTechnician || '') === String(query.assignedTechnician));
    }
    if (query.status) {
      results = results.filter((issue) => issue.status === query.status);
    }
    if (query.priority) {
      results = results.filter((issue) => issue.priority === query.priority);
    }
    if (query.$or) {
      results = results.filter((issue) => query.$or.some((clause) => {
        const [field] = Object.keys(clause);
        const rule = clause[field];
        if (rule && rule.$regex) {
          return new RegExp(rule.$regex, rule.$options || '').test(issue[field] || '');
        }
        return String(issue[field] || '').toLowerCase().includes(String(rule).toLowerCase());
      }));
    }

    return chainResult(results);
  });

  stub(Issue, 'create', async (data) => createIssue(data));

  stub(AssetHistory, 'create', async (data) => createAssetHistory(data));
  stub(AssetHistory, 'find', (query = {}) => {
    let results = [...store.history];
    if (query.asset) {
      results = results.filter((entry) => String(entry.asset) === String(query.asset));
    }
    return chainResult(results);
  });

  stub(MaintenanceRecord, 'create', async (data) => createMaintenanceRecord(data));
};

const makeAuthCookie = async (email, password) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  const cookie = response.headers['set-cookie']?.find((value) => value.startsWith('token='));
  assert.ok(cookie, 'Expected auth cookie');
  return cookie.split(';')[0];
};

test.before(async () => {
  process.env.JWT_SECRET = 'test-secret';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.CLIENT_URL = 'http://localhost:5173';
  process.env.NODE_ENV = 'test';
});

test.beforeEach(async () => {
  restoreStubs();
  await seedStore();
  setupStubs();
});

test.afterEach(() => {
  restoreStubs();
});

test('health route works', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.status, 'ok');
});

test('auth register/login/me/logout flow works', async () => {
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'New Admin', email: 'newadmin@test.local', password: 'Password123', role: 'admin' })
    .expect(201);

  const loginResponse = await request(app)
    .post('/api/auth/login')
    .send({ email: 'newadmin@test.local', password: 'Password123' })
    .expect(200);

  assert.equal(loginResponse.body.user.email, 'newadmin@test.local');
  assert.ok(loginResponse.headers['set-cookie']);

  const cookie = loginResponse.headers['set-cookie'][0].split(';')[0];

  const meResponse = await request(app)
    .get('/api/auth/me')
    .set('Cookie', cookie)
    .expect(200);

  assert.equal(meResponse.body.user.email, 'newadmin@test.local');

  await request(app)
    .post('/api/auth/logout')
    .set('Cookie', cookie)
    .expect(200);
});

test('admin can create asset and get qr/public page', async () => {
  const cookie = await makeAuthCookie('admin@test.local', 'Admin@123');

  const createResponse = await request(app)
    .post('/api/assets')
    .set('Cookie', cookie)
    .send({
      name: 'Lab Monitor 01',
      code: 'AST-MON-001',
      category: 'Display',
      location: 'Lab A',
      condition: 'Good',
      status: 'Operational',
    })
    .expect(201);

  assert.ok(createResponse.body.asset.code);
  assert.ok(createResponse.body.publicUrl);
  assert.ok(createResponse.body.qrCodeDataUrl.startsWith('data:image'));

  const assetsResponse = await request(app)
    .get('/api/assets')
    .set('Cookie', cookie)
    .expect(200);

  assert.ok(Array.isArray(assetsResponse.body.assets));
  assert.equal(assetsResponse.body.assets.length, 2);

  const publicResponse = await request(app)
    .get('/api/assets/public/AST-PROJ-001')
    .expect(200);

  assert.equal(publicResponse.body.asset.code, 'AST-PROJ-001');
  assert.ok(Array.isArray(publicResponse.body.recentIssues));
});

test('public issue reporting and triage work', async () => {
  const publicIssueResponse = await request(app)
    .post('/api/issues/public/AST-PROJ-001/report')
    .send({
      title: 'Display flickering',
      description: 'Screen flickers and HDMI is unstable.',
      priority: 'High',
      category: 'Display',
      reporterName: 'Student User',
      reporterEmail: 'student@test.local',
    })
    .expect(201);

  assert.ok(publicIssueResponse.body.issue.issueNumber);

  const asset = store.assets.find((entry) => entry.code === 'AST-PROJ-001');
  assert.equal(asset.status, 'Issue Reported');

  const triageCookie = await makeAuthCookie('admin@test.local', 'Admin@123');
  const triageResponse = await request(app)
    .post('/api/issues/triage')
    .set('Cookie', triageCookie)
    .send({ assetCode: 'AST-PROJ-001', complaint: 'The projector display is flickering and HDMI sometimes does not work.' })
    .expect(200);

  assert.equal(triageResponse.body.suggestion.priority, 'High');
  assert.ok(triageResponse.body.suggestion.title.length > 0);
});

test('assignment, status workflow, maintenance, and history work', async () => {
  const adminCookie = await makeAuthCookie('admin@test.local', 'Admin@123');
  const techCookie = await makeAuthCookie('tech@test.local', 'Tech@123');

  const issue = createIssue({
    issueNumber: 'ISU-TEST-001',
    asset: store.assets.find((entry) => entry.code === 'AST-PROJ-001')._id,
    assetCode: 'AST-PROJ-001',
    title: 'HDMI issue',
    description: 'HDMI fails intermittently',
    category: 'Connectivity',
    priority: 'High',
    reporterName: 'Student User',
    reporterEmail: 'student@test.local',
    status: 'Reported',
  });

  await request(app)
    .patch(`/api/issues/${issue._id}/assign`)
    .set('Cookie', adminCookie)
    .send({ technicianId: store.users.find((entry) => entry.email === 'tech@test.local')._id })
    .expect(200);

  await request(app)
    .patch(`/api/issues/${issue._id}/status`)
    .set('Cookie', techCookie)
    .send({ status: 'Inspection Started', note: 'Started inspection.' })
    .expect(200);

  await request(app)
    .patch(`/api/issues/${issue._id}/status`)
    .set('Cookie', techCookie)
    .send({ status: 'Maintenance In Progress', note: 'Replacing HDMI cable.' })
    .expect(200);

  await request(app)
    .post(`/api/issues/${issue._id}/maintenance`)
    .set('Cookie', techCookie)
    .send({
      notes: 'Replaced HDMI cable and verified input.',
      cost: 120,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      nextServiceDate: new Date(Date.now() + 86400000).toISOString(),
      partsUsed: [{ name: 'HDMI Cable', quantity: 1, cost: 120 }],
      evidence: ['https://example.com/evidence.jpg'],
    })
    .expect(201);

  const updatedAsset = store.assets.find((entry) => entry.code === 'AST-PROJ-001');
  assert.equal(updatedAsset.status, 'Operational');
  assert.ok(updatedAsset.lastServiceDate);

  const historyResponse = await request(app)
    .get(`/api/history/asset/${updatedAsset._id}`)
    .set('Cookie', adminCookie)
    .expect(200);

  assert.ok(Array.isArray(historyResponse.body.history));
  assert.ok(historyResponse.body.history.length >= 1);
});

test('admin can fetch technicians list and workers can see their own tasks', async () => {
  const adminCookie = await makeAuthCookie('admin@test.local', 'Admin@123');
  const techCookie = await makeAuthCookie('tech@test.local', 'Tech@123');
  const studentCookie = await makeAuthCookie('student@test.local', 'Student@123');

  await request(app)
    .get('/api/users/technicians')
    .set('Cookie', adminCookie)
    .expect(200);

  const ownIssues = await request(app)
    .get('/api/issues/my')
    .set('Cookie', studentCookie)
    .expect(200);

  assert.ok(Array.isArray(ownIssues.body.issues));
  assert.equal(ownIssues.body.issues.length, 0);

  const assignedIssues = await request(app)
    .get('/api/issues/assigned')
    .set('Cookie', techCookie)
    .expect(200);

  assert.ok(Array.isArray(assignedIssues.body.issues));
});
