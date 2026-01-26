/**
 * Booking Eligibility Calculator
 * 
 * Shared utility for calculating booking eligibility based on frequency rules.
 * This ensures frontend and backend use the same logic (bulletproof).
 * 
 * Frequency Rules:
 * - 1/year (monthly) → 1 month interval (12 times per year)
 * - 2/year → 6 months interval
 * - 3/year → 4 months interval
 * - 4/year → 3 months interval
 * - 6/year → 2 months interval
 * 
 * Formula: intervalMonths = 12 / timesPerYear
 * Note: timesPerYear=1 means monthly (12 times/year), stored as 1 for simplicity
 */

const Booking = require('../models/Booking');

/**
 * Map bookingIntervalMonths (times per year) to actual month interval
 * bookingIntervalMonths stores: 1, 2, 3, 4, 6 (times per year)
 * Returns: actual month interval (1, 6, 4, 3, 2)
 * Formula: intervalMonths = 12 / timesPerYear
 */
function getIntervalMonths(timesPerYear) {
  const mapping = {
    1: 1,  // 12/year (monthly) = 1 month
    2: 6,  // 2/year = 6 months
    3: 4,  // 3/year = 4 months
    4: 3,  // 4/year = 3 months
    6: 2,  // 6/year = 2 months
  };
  return mapping[timesPerYear] || 1; // Default to 1 month if invalid
}

/**
 * Get friendly text for booking frequency
 */
function getFrequencyText(timesPerYear) {
  const mapping = {
    1: 'Monthly (12 times per year)',
    2: '2 times per year (every 6 months)',
    3: '3 times per year (every 4 months)',
    4: '4 times per year (every 3 months)',
    6: '6 times per year (every 2 months)',
  };
  return mapping[timesPerYear] || 'monthly';
}

/**
 * Calculate next eligible booking date in Toronto timezone
 * 
 * Rules:
 * 1. Find most recent CONFIRMED (accepted) booking
 * 2. Take that scheduled date (not created_at)
 * 3. Add the plan's month interval
 * 4. Snap to first day of resulting month at 00:00 Toronto time
 * 
 * @param {Date} lastBookingDate - The scheduled date of the last confirmed booking
 * @param {Number} timesPerYear - Booking frequency (1=monthly, 2, 3, 4, or 6)
 * @returns {Date} Next eligible date (first day of month, 00:00 Toronto time, stored as UTC)
 */
function calculateNextEligibleDate(lastBookingDate, timesPerYear) {
  // Get the actual month interval
  const intervalMonths = getIntervalMonths(timesPerYear);
  
  // Get the date components in Toronto timezone
  // This ensures we work with the month as the customer sees it in Toronto
  const torontoYear = parseInt(lastBookingDate.toLocaleString('en-US', { 
    timeZone: 'America/Toronto',
    year: 'numeric'
  }));
  const torontoMonth = parseInt(lastBookingDate.toLocaleString('en-US', { 
    timeZone: 'America/Toronto',
    month: 'numeric'
  })); // 1-12 (January = 1, December = 12)
  
  // Add interval months to get target month
  // Example: January (1) + 4 months = May (5)
  let targetYear = torontoYear;
  let targetMonth = torontoMonth + intervalMonths;
  
  // Handle year rollover
  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }
  
  // Create a date string for the first of the target month
  // Format: "YYYY-MM-DD" 
  const targetDateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  
  // To create a date that represents "first of month at 00:00 Toronto time",
  // we need to account for Toronto's timezone offset
  // Toronto is UTC-5 (EST) or UTC-4 (EDT) - JavaScript handles DST automatically
  
  // Method: Create a date at a known UTC time, then calculate what UTC time
  // represents midnight in Toronto for that date
  
  // Create a test date at noon UTC on the target date
  const testDate = new Date(`${targetDateStr}T12:00:00Z`);
  
  // Get what hour noon UTC is in Toronto (will be 7 or 8 AM depending on DST)
  const torontoHour = parseInt(testDate.toLocaleString('en-US', { 
    timeZone: 'America/Toronto',
    hour: '2-digit',
    hour12: false
  }));
  
  // Calculate offset: if UTC noon = 7 AM Toronto (EST), offset is 5 hours
  // If UTC noon = 8 AM Toronto (EDT), offset is 4 hours
  const offsetHours = 12 - torontoHour;
  
  // Create date for Toronto midnight
  // Toronto midnight = UTC (00:00 + offsetHours)
  // Example: If offset is 5, Toronto midnight = UTC 05:00
  const result = new Date(`${targetDateStr}T${String(offsetHours).padStart(2, '0')}:00:00Z`);
  
  return result;
}

/**
 * Check if a customer is eligible to book on a given date
 * 
 * @param {String} customerId - Customer ID
 * @param {Date} requestedDate - Date customer wants to book
 * @returns {Object} { eligible: boolean, nextEligibleDate: Date | null, message: string | null }
 */
async function checkBookingEligibility(customerId, requestedDate) {
  // Find most recent CONFIRMED (accepted) booking
  const lastBooking = await Booking.findOne({
    customer: customerId,
    status: 'accepted' // Only confirmed bookings count
  }).sort({ date: -1 }); // Most recent first
  
  // If no confirmed booking, customer can book immediately
  if (!lastBooking) {
    return {
      eligible: true,
      nextEligibleDate: null,
      message: null
    };
  }
  
  // Get customer's booking frequency
  const User = require('../models/User');
  const customer = await User.findById(customerId);
  const timesPerYear = customer?.bookingIntervalMonths || 1; // Default to monthly (12/year) if not set
  
  // Calculate next eligible date
  const nextEligibleDate = calculateNextEligibleDate(lastBooking.date, timesPerYear);
  
  // Check if requested date is on or after next eligible date
  const requested = new Date(requestedDate);
  const eligible = requested >= nextEligibleDate;
  
  if (!eligible) {
    // Format date for display in Toronto timezone
    const formattedDate = nextEligibleDate.toLocaleDateString('en-US', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return {
      eligible: false,
      nextEligibleDate: nextEligibleDate,
      message: `Not eligible until ${formattedDate}`,
      timesPerYear: timesPerYear,
      intervalMonths: getIntervalMonths(timesPerYear)
    };
  }
  
  return {
    eligible: true,
    nextEligibleDate: nextEligibleDate,
    message: null
  };
}

/**
 * Get next eligible date for a customer (for frontend display)
 * 
 * @param {String} customerId - Customer ID
 * @returns {Object} { nextEligibleDate: Date | null, timesPerYear: number, intervalMonths: number }
 */
async function getNextEligibleDate(customerId) {
  // Find most recent CONFIRMED (accepted) booking
  const lastBooking = await Booking.findOne({
    customer: customerId,
    status: 'accepted'
  }).sort({ date: -1 });
  
  // If no confirmed booking, customer can book immediately
  if (!lastBooking) {
    const User = require('../models/User');
    const customer = await User.findById(customerId);
    const timesPerYear = customer?.bookingIntervalMonths || 1; // Default to monthly (12/year)
    
    return {
      nextEligibleDate: null, // No restriction
      timesPerYear: timesPerYear,
      intervalMonths: getIntervalMonths(timesPerYear),
      canBookImmediately: true
    };
  }

  // Get customer's booking frequency
  const User = require('../models/User');
  const customer = await User.findById(customerId);
  const timesPerYear = customer?.bookingIntervalMonths || 1; // Default to monthly (12/year)
  
  // Calculate next eligible date
  const nextEligibleDate = calculateNextEligibleDate(lastBooking.date, timesPerYear);
  
  return {
    nextEligibleDate: nextEligibleDate,
    timesPerYear: timesPerYear,
    intervalMonths: getIntervalMonths(timesPerYear),
    canBookImmediately: false,
    lastBookingDate: lastBooking.date
  };
}

module.exports = {
  calculateNextEligibleDate,
  checkBookingEligibility,
  getNextEligibleDate,
  getIntervalMonths,
  getFrequencyText
};
