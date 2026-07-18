const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail } = require('./emailService');

const createNotification = async ({ userId, type, title, message, relatedIssue, sendEmailAlert = true }) => {
  const notification = await Notification.create({
    user: userId,
    type,
    title,
    message,
    relatedIssue,
  });

  if (sendEmailAlert) {
    const user = await User.findById(userId);
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: `[MaintainIQ] ${title}`,
        text: message,
      });
    }
  }

  return notification;
};

const notifyAdmins = async ({ type, title, message, relatedIssue }) => {
  const admins = await User.find({ role: 'admin', isActive: true });
  return Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin._id,
        type,
        title,
        message,
        relatedIssue,
      })
    )
  );
};

const notifyUser = async (params) => createNotification(params);

// Supervisors of a category get notified about their team's work
// (assignments, resolutions) so they can monitor and review it.
const notifySupervisors = async ({ category, excludeUserId, type, title, message, relatedIssue }) => {
  if (!category) return [];
  const supervisors = await User.find({
    role: 'technician',
    isActive: true,
    supervisorCategories: category,
  });
  return Promise.all(
    supervisors
      .filter((supervisor) => !excludeUserId || supervisor._id.toString() !== excludeUserId.toString())
      .map((supervisor) =>
        createNotification({
          userId: supervisor._id,
          type,
          title,
          message,
          relatedIssue,
        })
      )
  );
};

module.exports = { createNotification, notifyAdmins, notifyUser, notifySupervisors };
