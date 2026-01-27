/**
 * For routes that allow customer or receptionist to access Media Day booking.
 * - Customer: always allowed (no canBookMediaDay check).
 * - Receptionist: only if canBookMediaDay === true; otherwise 403.
 * Use after authorizeRole(['customer','receptionist']) and before resolveEffectiveCustomerId.
 */
const requireCanBookMediaDay = (req, res, next) => {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ message: 'Unauthorized: User role not found.' });
  }
  if (req.user.role === 'receptionist' && req.user.canBookMediaDay !== true) {
    return res.status(403).json({ message: 'Forbidden: You do not have permission to book Media Days.' });
  }
  next();
};

module.exports = requireCanBookMediaDay;
