const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id; // User ID from authenticated token

    // Fetch notifications from the database for the specific user
    const notifications = await Notification.find({ userId: userId }).sort({ timestamp: -1 });

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Authenticated User (Admin, Customer, Employee)
exports.markNotificationAsRead = async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id; // User ID from authenticated token

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: userId }, // Ensure the notification belongs to the user
      { read: true },
      { new: true } // Return the updated document
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found or not belonging to user.' });
    }

    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// @desc    Mark all notifications for a user as read
// @route   PUT /api/notifications/mark-all-read
// @access  Authenticated User (Admin, Customer, Employee)
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id; // User ID from authenticated token

    await Notification.updateMany(
      { userId: userId, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 