require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Asset = require('../models/Asset');
const Issue = require('../models/Issue');
const { createHistoryEntry } = require('../services/historyService');

const seed = async () => {
  await connectDB();

  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const technicianPassword = await bcrypt.hash('Tech@123', 10);

  const admin = await User.findOneAndUpdate(
    { email: 'admin@maintainiq.local' },
    {
      name: 'Admin User',
      email: 'admin@maintainiq.local',
      password: adminPassword,
      role: 'admin',
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const technician = await User.findOneAndUpdate(
    { email: 'tech@maintainiq.local' },
    {
      name: 'Technician User',
      email: 'tech@maintainiq.local',
      password: technicianPassword,
      role: 'technician',
      isActive: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const asset = await Asset.findOneAndUpdate(
    { code: 'AST-PROJ-001' },
    {
      name: 'Classroom Projector 01',
      code: 'AST-PROJ-001',
      category: 'Projector',
      location: 'Room 12',
      condition: 'Good',
      status: 'Issue Reported',
      lastServiceDate: new Date('2026-06-20'),
      nextServiceDate: new Date('2026-08-20'),
      assignedTechnician: technician._id,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const issue = await Issue.findOneAndUpdate(
    { issueNumber: 'ISU-DEMO-001' },
    {
      issueNumber: 'ISU-DEMO-001',
      asset: asset._id,
      assetCode: asset.code,
      title: 'Projector display flickering',
      description: 'Display flickers and HDMI input is unstable.',
      category: 'Display',
      priority: 'High',
      reporterName: 'Demo Reporter',
      reporterEmail: 'reporter@demo.local',
      status: 'Assigned',
      assignedTechnician: technician._id,
      maintenanceNotes: 'HDMI cable suspected damaged during inspection.',
      evidence: [],
      aiSuggestion: {
        title: 'Display instability or flickering',
        category: 'Display',
        priority: 'High',
        possibleCauses: ['Faulty cable', 'Loose connector', 'Internal panel issue'],
        initialChecks: ['Check the connection cable', 'Restart the device safely', 'Inspect display input settings'],
        warning: 'This output is advisory. A qualified technician must confirm the diagnosis.',
        reviewedByUser: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await createHistoryEntry({
    asset: asset._id,
    issue: issue._id,
    actor: admin._id,
    actorName: admin.name,
    action: 'Demo data seeded',
    details: 'Sample asset and issue created for the hackathon demo',
  });

  console.log('Seed complete');
  console.log('Admin login: admin@maintainiq.local / Admin@123');
  console.log('Technician login: tech@maintainiq.local / Tech@123');
  process.exit(0);
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
