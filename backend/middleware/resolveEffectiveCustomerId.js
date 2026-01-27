/**
 * Sets req.effectiveCustomerId for routes that allow customer or receptionist.
 * - Customer: effectiveCustomerId = req.user._id
 * - Receptionist: effectiveCustomerId = req.user.parentCustomerId (the linked clinic)
 * Use only after authorizeRole(['customer','receptionist']).
 */
const resolveEffectiveCustomerId = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized: User not found.' });
  }
  // Receptionist without parentCustomerId is invalid
  if (req.user.role === 'receptionist' && !req.user.parentCustomerId) {
    return res.status(403).json({ message: 'Forbidden: Receptionist account is not properly linked.' });
  }
  req.effectiveCustomerId = req.user.parentCustomerId || req.user._id || req.user.id;
  next();
};

module.exports = resolveEffectiveCustomerId;
