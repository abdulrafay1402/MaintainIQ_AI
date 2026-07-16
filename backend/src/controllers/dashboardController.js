const Asset = require("../models/Asset");
const Issue = require("../models/Issue");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

const getAdminDashboard = asyncHandler(async (req, res) => {
  const [
    totalEquipment,
    activeEquipment,
    faultyEquipment,
    outOfService,
    pendingRequests,
    assignedIssues,
    resolvedThisMonth,
    recentIssues,
    statusDistribution,
    categoryDistribution,
  ] = await Promise.all([
    Asset.countDocuments({ status: { $ne: "Retired" } }),
    Asset.countDocuments({ status: "Operational" }),
    Asset.countDocuments({ status: { $in: ["Issue Reported", "Faulty"] } }),
    Asset.countDocuments({ status: "Out of Service" }),
    Issue.countDocuments({ status: "Reported" }),
    Issue.countDocuments({ status: "Assigned" }),
    Issue.countDocuments({
      status: { $in: ["Resolved", "Verified", "Closed"] },
      resolvedAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    }),
    Issue.find()
      .populate("asset", "name code location")
      .populate("assignedTechnician", "name")
      .sort({ createdAt: -1 })
      .limit(8),
    Issue.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Issue.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]),
  ]);

  res.json({
    stats: {
      totalEquipment,
      activeEquipment,
      faultyEquipment,
      outOfService,
      pendingRequests,
      assignedIssues,
      resolvedThisMonth,
    },
    recentIssues,
    statusDistribution,
    categoryDistribution,
  });
});

const getStudentDashboard = asyncHandler(async (req, res) => {
  const filter = {
    $or: [{ reporterId: req.user._id }, { reporterEmail: req.user.email }],
  };

  const [total, pending, inProgress, completed, recentComplaints] =
    await Promise.all([
      Issue.countDocuments(filter),
      Issue.countDocuments({
        ...filter,
        status: { $in: ["Reported", "Assigned"] },
      }),
      Issue.countDocuments({
        ...filter,
        status: {
          $in: [
            "Inspection Started",
            "Maintenance In Progress",
            "Waiting for Parts",
          ],
        },
      }),
      Issue.countDocuments({
        ...filter,
        status: { $in: ["Resolved", "Verified", "Closed"] },
      }),
      Issue.find(filter)
        .populate("asset", "name code location status")
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

  res.json({
    stats: { total, pending, inProgress, completed },
    recentComplaints,
  });
});

const getTechnicianDashboard = asyncHandler(async (req, res) => {
  const filter = { assignedTechnician: req.user._id };

  const [assigned, pending, inProgress, completed, recentTasks] =
    await Promise.all([
      Issue.countDocuments(filter),
      Issue.countDocuments({ ...filter, status: "Assigned" }),
      Issue.countDocuments({
        ...filter,
        status: {
          $in: [
            "Inspection Started",
            "Maintenance In Progress",
            "Waiting for Parts",
          ],
        },
      }),
      Issue.countDocuments({
        ...filter,
        status: { $in: ["Resolved", "Verified", "Closed"] },
      }),
      Issue.find(filter)
        .populate("asset", "name code location category status")
        .sort({ updatedAt: -1 })
        .limit(10),
    ]);

  res.json({
    stats: { assigned, pending, inProgress, completed },
    recentTasks,
  });
});

module.exports = {
  getAdminDashboard,
  getStudentDashboard,
  getTechnicianDashboard,
};
