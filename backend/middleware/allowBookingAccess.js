/**
 * For GET /blocked-dates and GET /bookings/accepted (read-only, not customer-scoped).
 * Allows: admin, customer, employee; or receptionist with canBookMediaDay === true.
 * Otherwise 403.
 */
const allowBookingAccess = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Unauthorized: User role not found.' });
  }
  if (['admin', 'customer', 'employee'].includes(req.user.role)) {
    return next();
  }
  if (req.user.role === 'receptionist' && req.user.canBookMediaDay === true) {
    return next();
  }
  return res.status(403).json({ message: 'Forbidden: You do not have access to this resource.' });
};

module.exports = allowBookingAccess;
