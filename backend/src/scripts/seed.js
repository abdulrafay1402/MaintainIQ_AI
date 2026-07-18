/**
 * Seeds demo data for MaintainIQ.
 *
 * Usage:
 *   npm run seed            -> upserts demo users + sample assets/issues (idempotent, keeps existing data)
 *   npm run seed -- --fresh -> wipes assets/issues/history/maintenance/notifications first, then seeds
 *
 * Demo credentials (all pre-verified, no OTP email needed):
 *   Admin:      admin@maintainiq.local  / Admin@123
 *   Technician: tech@maintainiq.local   / Tech@123
 *   Technician: tech2@maintainiq.local  / Tech@123
 *   Student:    student@maintainiq.local / Student@123
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = require('../config/db');
const User = require('../models/User');
const Asset = require('../models/Asset');
const Issue = require('../models/Issue');
const MaintenanceRecord = require('../models/MaintenanceRecord');
const Notification = require('../models/Notification');

const FRESH = process.argv.includes('--fresh');

const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const daysAhead = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const upsertUser = async ({ name, email, password, role, expertise = [], studentId, department }) => {
  const existing = await User.findOne({ email });
  if (existing) {
    existing.isVerified = true;
    await existing.save();
    return existing;
  }
  return User.create({
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role,
    expertise,
    studentId,
    department,
    isVerified: true,
    isActive: true,
  });
};

const ASSETS = [
  { name: 'Classroom Projector 01', code: 'PROJ-001', category: 'Electronics / IT', location: 'Main Campus', building: 'A', floor: '2', roomNumber: 'A-204', condition: 'Good', purchaseDate: daysAgo(400), lastServiceDate: daysAgo(35), nextServiceDate: daysAhead(55), maintenanceFrequencyDays: 90 },
  { name: 'Lab AC Split Unit', code: 'AC-101', category: 'HVAC / Air Conditioning', location: 'Computer Lab 1', building: 'B', floor: '1', roomNumber: 'B-102', condition: 'Fair', purchaseDate: daysAgo(800), lastServiceDate: daysAgo(80), nextServiceDate: daysAhead(10), maintenanceFrequencyDays: 90 },
  { name: 'Water Dispenser Lobby', code: 'WD-003', category: 'Plumbing', location: 'Main Lobby', building: 'A', floor: 'G', condition: 'Good', purchaseDate: daysAgo(300), lastServiceDate: daysAgo(20), nextServiceDate: daysAhead(70) },
  { name: 'Lecture Hall Sound System', code: 'SND-014', category: 'Electronics / IT', location: 'Lecture Hall 2', building: 'C', floor: '1', roomNumber: 'C-110', condition: 'Good', purchaseDate: daysAgo(600), lastServiceDate: daysAgo(60), nextServiceDate: daysAhead(30) },
  { name: 'Backup Generator', code: 'GEN-002', category: 'Electrical', location: 'Utility Yard', building: 'Ext', condition: 'Good', purchaseDate: daysAgo(1200), lastServiceDate: daysAgo(15), nextServiceDate: daysAhead(75), maintenanceFrequencyDays: 90 },
  { name: 'Library Printer Station', code: 'PRN-007', category: 'Electronics / IT', location: 'Library', building: 'A', floor: '1', condition: 'Fair', purchaseDate: daysAgo(500), lastServiceDate: daysAgo(45), nextServiceDate: daysAhead(45) },
  { name: 'Chemistry Lab Fume Hood', code: 'LAB-021', category: 'Lab Equipment', location: 'Chemistry Lab', building: 'B', floor: '2', roomNumber: 'B-210', condition: 'Good', purchaseDate: daysAgo(900), lastServiceDate: daysAgo(25), nextServiceDate: daysAhead(65) },
  { name: 'Cafeteria Refrigerator', code: 'REF-005', category: 'Electrical', location: 'Cafeteria', building: 'A', floor: 'G', condition: 'Poor', purchaseDate: daysAgo(1500), lastServiceDate: daysAgo(100), nextServiceDate: daysAhead(5) },
  { name: 'Fire Extinguisher Corridor B', code: 'SAF-030', category: 'Safety & Security', location: 'Corridor B', building: 'B', floor: '1', condition: 'Good', purchaseDate: daysAgo(200), lastServiceDate: daysAgo(50), nextServiceDate: daysAhead(130) },
  { name: 'Auditorium Stage Lights', code: 'LGT-011', category: 'Electrical', location: 'Auditorium', building: 'C', floor: 'G', condition: 'Good', purchaseDate: daysAgo(700), lastServiceDate: daysAgo(30), nextServiceDate: daysAhead(60) },
  { name: 'Admin Office UPS', code: 'UPS-004', category: 'Electrical', location: 'Admin Office', building: 'A', floor: '1', condition: 'Fair', purchaseDate: daysAgo(650), lastServiceDate: daysAgo(70), nextServiceDate: daysAhead(20) },
  { name: 'Old Server Rack (Decommissioned)', code: 'SRV-000', category: 'Electronics / IT', location: 'Store Room', building: 'A', floor: 'B1', condition: 'Poor', status: 'Retired', purchaseDate: daysAgo(2500) },
];

const seed = async () => {
  await connectDB();
  console.log(FRESH ? 'Seeding with --fresh (wiping demo collections)...' : 'Seeding (idempotent upserts)...');

  if (FRESH) {
    // AssetHistory blocks deleteMany at the mongoose layer (immutability guard),
    // so the raw driver collection is used for a clean wipe.
    await Promise.all([
      Issue.deleteMany({}),
      Asset.deleteMany({}),
      MaintenanceRecord.deleteMany({}),
      Notification.deleteMany({}),
      mongoose.connection.collection('assethistories').deleteMany({}),
    ]);
  }

  const admin = await upsertUser({ name: 'Demo Admin', email: 'admin@maintainiq.local', password: 'Admin@123', role: 'admin', department: 'Facilities Management' });
  const tech1 = await upsertUser({ name: 'Bilal Technician', email: 'tech@maintainiq.local', password: 'Tech@123', role: 'technician', expertise: ['Electronics / IT', 'Electrical'] });
  const tech2 = await upsertUser({ name: 'Sana Technician', email: 'tech2@maintainiq.local', password: 'Tech@123', role: 'technician', expertise: ['HVAC / Air Conditioning', 'Plumbing'] });
  const student = await upsertUser({ name: 'Demo Student', email: 'student@maintainiq.local', password: 'Student@123', role: 'student', studentId: 'STU-2024-001', department: 'Computer Science' });
  console.log('Users ready: admin, 2 technicians, student');

  const { createHistoryEntry } = require('../services/historyService');
  const assetDocs = {};

  for (const data of ASSETS) {
    let asset = await Asset.findOne({ code: data.code });
    if (!asset) {
      asset = await Asset.create(data);
      await createHistoryEntry({
        asset: asset._id,
        actor: admin._id,
        actorName: admin.name,
        action: 'Asset created',
        details: `${asset.name} was registered with code ${asset.code}`,
      });
    }
    assetDocs[data.code] = asset;
  }
  console.log(`Assets ready: ${Object.keys(assetDocs).length}`);

  const existingIssues = await Issue.countDocuments();
  if (existingIssues > 0 && !FRESH) {
    console.log(`Issues already exist (${existingIssues}) — skipping demo issues. Use "npm run seed -- --fresh" for a clean slate.`);
  } else {
    const mkIssue = async ({ asset, title, description, category, priority, status, reporter, technician, createdDaysAgo, timeline, extra = {} }) => {
      const issue = await Issue.create({
        issueNumber: `ISU-DEMO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        asset: asset._id,
        assetCode: asset.code,
        title,
        description,
        category,
        priority,
        status,
        reporterName: reporter.name,
        reporterEmail: reporter.email,
        reporterId: reporter._id,
        studentId: reporter.studentId,
        assignedTechnician: technician?._id,
        timeline: timeline.map((entry, index) => ({
          ...entry,
          createdAt: daysAgo(createdDaysAgo - index * 0.4),
        })),
        createdAt: daysAgo(createdDaysAgo),
        ...extra,
      });
      await createHistoryEntry({
        asset: asset._id,
        issue: issue._id,
        actorName: reporter.name,
        actor: reporter._id,
        action: 'Issue reported',
        details: `${issue.issueNumber}: ${title}`,
      });
      return issue;
    };

    // 1. Fresh unassigned report
    await mkIssue({
      asset: assetDocs['PRN-007'],
      title: 'Printer paper jam and streaky output',
      description: 'The library printer keeps jamming and printed pages have black streaks.',
      category: 'Electronics / IT',
      priority: 'Medium',
      status: 'Reported',
      reporter: student,
      createdDaysAgo: 1,
      timeline: [{ fromStatus: null, toStatus: 'Reported', actorName: student.name, note: 'Issue submitted from the public asset page' }],
    });
    assetDocs['PRN-007'].status = 'Issue Reported';
    await assetDocs['PRN-007'].save();

    // 2. Assigned, inspection running
    await mkIssue({
      asset: assetDocs['AC-101'],
      title: 'AC water leakage and weak cooling',
      description: 'AC pani tapak raha hai aur cooling bhi kam hai. (Water leaking, weak cooling.)',
      category: 'HVAC / Air Conditioning',
      priority: 'High',
      status: 'Inspection Started',
      reporter: student,
      technician: tech2,
      createdDaysAgo: 3,
      timeline: [
        { fromStatus: null, toStatus: 'Reported', actorName: student.name, note: 'Issue submitted from the public asset page' },
        { fromStatus: 'Reported', toStatus: 'Assigned', actor: admin._id, actorName: admin.name, note: 'Assigned to Sana Technician' },
        { fromStatus: 'Assigned', toStatus: 'Inspection Started', actor: tech2._id, actorName: tech2.name, note: 'Checking drainage pipe and filters' },
      ],
      extra: {
        aiSuggestion: {
          title: 'Water leakage and reduced cooling performance',
          category: 'HVAC / Air Conditioning',
          priority: 'High',
          possibleCauses: ['Blocked drain pipe', 'Dirty air filter', 'Frozen evaporator coil'],
          initialChecks: ['Turn off the unit if water is near electrical wiring', 'Inspect the drain tray and pipe', 'Check filter condition'],
          warning: 'Water near electrical components — switch off the unit before inspection.',
          reviewedByUser: true,
        },
      },
    });
    assetDocs['AC-101'].status = 'Under Inspection';
    assetDocs['AC-101'].assignedTechnician = tech2._id;
    await assetDocs['AC-101'].save();

    // 3. Waiting for parts (critical, visually distinct)
    await mkIssue({
      asset: assetDocs['REF-005'],
      title: 'Refrigerator compressor failure — food safety risk',
      description: 'Cafeteria refrigerator is not cooling at all; compressor makes clicking sounds.',
      category: 'Electrical',
      priority: 'Critical',
      status: 'Waiting for Parts',
      reporter: student,
      technician: tech1,
      createdDaysAgo: 6,
      timeline: [
        { fromStatus: null, toStatus: 'Reported', actorName: student.name, note: 'Issue submitted from the public asset page' },
        { fromStatus: 'Reported', toStatus: 'Assigned', actor: admin._id, actorName: admin.name, note: 'Assigned to Bilal Technician' },
        { fromStatus: 'Assigned', toStatus: 'Inspection Started', actor: tech1._id, actorName: tech1.name, note: 'Compressor start relay suspected' },
        { fromStatus: 'Inspection Started', toStatus: 'Waiting for Parts', actor: tech1._id, actorName: tech1.name, note: 'Replacement relay ordered' },
      ],
    });
    assetDocs['REF-005'].status = 'Under Maintenance';
    assetDocs['REF-005'].assignedTechnician = tech1._id;
    await assetDocs['REF-005'].save();

    // 4. Fully resolved with maintenance record + AI summary (the golden demo flow)
    const resolved = await mkIssue({
      asset: assetDocs['PROJ-001'],
      title: 'Projector flickering and HDMI detection failure',
      description: 'The projector display is flickering and sometimes does not detect HDMI.',
      category: 'Electronics / IT',
      priority: 'High',
      status: 'Resolved',
      reporter: student,
      technician: tech1,
      createdDaysAgo: 10,
      timeline: [
        { fromStatus: null, toStatus: 'Reported', actorName: student.name, note: 'Issue submitted from the public asset page' },
        { fromStatus: 'Reported', toStatus: 'Assigned', actor: admin._id, actorName: admin.name, note: 'Assigned to Bilal Technician' },
        { fromStatus: 'Assigned', toStatus: 'Inspection Started', actor: tech1._id, actorName: tech1.name, note: 'Inspecting cable and ports' },
        { fromStatus: 'Inspection Started', toStatus: 'Maintenance In Progress', actor: tech1._id, actorName: tech1.name, note: 'HDMI cable damaged near connector' },
        { fromStatus: 'Maintenance In Progress', toStatus: 'Resolved', actor: tech1._id, actorName: tech1.name, note: 'Replaced HDMI cable, tested all inputs' },
      ],
      extra: {
        maintenanceNotes: 'Replaced damaged HDMI cable and reseated the input board connector. Tested with laptop and document camera.',
        inspectionFindings: 'HDMI cable insulation cracked near the connector; intermittent contact caused flicker.',
        workPerformed: 'Replaced HDMI cable (2m, high-speed), cleaned dust filters, verified all input sources.',
        partsUsed: [{ name: 'HDMI cable 2m', quantity: 1, cost: 1200 }],
        maintenanceCost: 1200,
        durationHours: 1.5,
        finalCondition: 'Good',
        resolvedAt: daysAgo(8),
        aiMaintenanceSummary: 'The reported display flicker was traced to a damaged HDMI cable with cracked insulation near the connector. The cable was replaced, the input board connector reseated, and all input sources verified as stable.',
        aiPreventiveRecommendation: 'Inspect HDMI connectors and cable routing every 2 months; use strain-relief clips so cables are not bent sharply at the projector inlet.',
      },
    });

    await MaintenanceRecord.create({
      issue: resolved._id,
      asset: assetDocs['PROJ-001']._id,
      technician: tech1._id,
      notes: resolved.maintenanceNotes,
      partsUsed: resolved.partsUsed,
      cost: resolved.maintenanceCost,
      startedAt: daysAgo(9),
      completedAt: daysAgo(8),
      nextServiceDate: daysAhead(55),
      inspectionFindings: resolved.inspectionFindings,
      workPerformed: resolved.workPerformed,
      finalCondition: 'Good',
      durationHours: 1.5,
    });
    await createHistoryEntry({
      asset: assetDocs['PROJ-001']._id,
      issue: resolved._id,
      actor: tech1._id,
      actorName: tech1.name,
      action: 'Maintenance recorded',
      details: resolved.maintenanceNotes,
    });
    console.log('Demo issues ready: reported, in-inspection, waiting-for-parts, resolved');
  }

  console.log('\nSeed complete. Demo credentials:');
  console.log('  Admin:      admin@maintainiq.local  / Admin@123');
  console.log('  Technician: tech@maintainiq.local   / Tech@123');
  console.log('  Technician: tech2@maintainiq.local  / Tech@123');
  console.log('  Student:    student@maintainiq.local / Student@123');
  await mongoose.disconnect();
};

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
