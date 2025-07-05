import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../../utils/api';

// Types
export interface Booking {
  _id: string;
  date: string;
  notes: string;
  status: 'pending' | 'accepted' | 'declined';
  adminMessage?: string;
  createdAt: string;
  photographer?: {
    _id: string;
    name: string;
    email: string;
  } | null;
}

export interface TimeSlot {
  id: number;
  time: string;
}

// Constants
const TIME_SLOTS: TimeSlot[] = [
  { id: 1, time: '10:00 AM' },
  { id: 2, time: '11:00 AM' },
  { id: 3, time: '12:00 PM' },
  { id: 4, time: '1:00 PM' },
  { id: 5, time: '2:00 PM' },
];

const ERROR_MESSAGES = {
  LOGIN_REQUIRED: 'You must be logged in to perform this action',
  PENDING_BOOKING_EXISTS: 'You already have a pending booking request. Please wait for a response before making another request.',
  DATE_TIME_REQUIRED: 'Please select both a date and time',
  SERVER_ERROR: 'No response from server. Please check if the server is running.',
  FETCH_ERROR: 'Failed to load bookings',
  CREATE_ERROR: 'Failed to create booking',
  DATE_BLOCKED: 'This date is blocked and cannot be booked.',
  DATE_DECLINED: 'You have a declined booking on this date and cannot book again.',
  DATE_ACCEPTED: 'Media day already scheduled for the selected date',
} as const;

// Utility functions
const formatDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const isSameDate = (date1: Date, date2: Date): boolean => {
  return formatDateString(date1) === formatDateString(date2);
};

const getHourFromTimeString = (time: string): number => {
  const [raw, period] = time.split(' ');
  let [hour, minute] = raw.split(':').map(Number);
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour;
};

const getHourFromDate = (date: string): number => {
  return new Date(date).getHours();
};

const isTimeAllowedForSelectedDate = (date: Date | null, time: string | null, acceptedBookings: Booking[]): boolean => {
  if (!date || !time) return false;
  if (acceptedBookings.length === 0) return true;
  const acceptedHours = acceptedBookings.map(b => getHourFromDate(b.date));
  const takenHours = new Set(acceptedHours);
  const slotHour = getHourFromTimeString(time);
  if (takenHours.has(slotHour)) return false;
  for (const acceptedHour of acceptedHours) {
    if (Math.abs(slotHour - acceptedHour) < 3) return false;
  }
  return true;
};

export const useMediaDayBooking = () => {
  // State
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [acceptedBookingsForDate, setAcceptedBookingsForDate] = useState<Booking[]>([]);

  // Computed values
  const hasPendingBooking = useMemo(() => 
    bookings.some(booking => booking.status === 'pending'), 
    [bookings]
  );

  // Fetch all accepted bookings for the selected date
  const fetchAcceptedBookingsForDate = useCallback(async (date: Date | null) => {
    if (!date) {
      setAcceptedBookingsForDate([]);
      return;
    }
    try {
      const token = localStorage.getItem('customerToken');
      const dateString = date.toISOString().split('T')[0];
      const response = await axios.get(`${API_BASE_URL}/bookings/accepted?date=${dateString}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAcceptedBookingsForDate(response.data);
    } catch (err) {
      setAcceptedBookingsForDate([]);
    }
  }, []);

  // Fetch accepted bookings whenever selectedDate changes
  useEffect(() => {
    fetchAcceptedBookingsForDate(selectedDate);
  }, [selectedDate, fetchAcceptedBookingsForDate]);

  // Filtered time slots for the selected date
  const filteredTimeSlots = useMemo(() => {
    if (!selectedDate) return TIME_SLOTS;
    if (acceptedBookingsForDate.length === 0) {
      return TIME_SLOTS;
    }
    const acceptedHours = acceptedBookingsForDate.map(b => getHourFromDate(b.date));
    const takenHours = new Set(acceptedHours);
    return TIME_SLOTS.filter(slot => {
      const slotHour = getHourFromTimeString(slot.time);
      if (takenHours.has(slotHour)) return false;
      for (const acceptedHour of acceptedHours) {
        if (Math.abs(slotHour - acceptedHour) < 3) return false;
      }
      return true;
    });
  }, [selectedDate, acceptedBookingsForDate]);

  // Utility functions
  const getAuthToken = useCallback(() => {
    const token = localStorage.getItem('customerToken');
    if (!token) {
      throw new Error(ERROR_MESSAGES.LOGIN_REQUIRED);
    }
    return token;
  }, []);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const setTemporaryError = useCallback((message: string, duration: number = 3000) => {
    setError(message);
    setTimeout(() => setError(null), duration);
  }, []);

  const resetForm = useCallback(() => {
    setSelectedDate(null);
    setSelectedTime(null);
    setNotes('');
    setIsTimeModalOpen(false);
  }, []);

  // API calls
  const fetchBookings = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get(`${API_BASE_URL}/bookings/my-bookings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (err: any) {
      setError(ERROR_MESSAGES.FETCH_ERROR);
    } finally {
      setIsLoadingBookings(false);
    }
  }, [getAuthToken]);

  const fetchBlockedDates = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get(`${API_BASE_URL}/blocked-dates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Only treat manual blocks as full-day blocks
      const manualBlockedDates = response.data.filter((block: any) => block.isManualBlock);
      setBlockedDates(manualBlockedDates.map((block: any) => block.date));
    } catch (err) {
      // Silently fail for blocked dates as it's not critical
    }
  }, [getAuthToken]);

  // Event handlers
  const handleDateSelect = useCallback((date: Date) => {
    if (hasPendingBooking) {
      setTemporaryError(ERROR_MESSAGES.PENDING_BOOKING_EXISTS);
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) return;
    
    setSelectedDate(date);
    setIsTimeModalOpen(true);
    clearMessages();
  }, [hasPendingBooking, setTemporaryError, clearMessages]);

  const handleTimeSelect = useCallback((time: string) => {
    setSelectedTime(time);
    clearMessages();
  }, [clearMessages]);

  const parseTimeToDate = useCallback((time: string, date: Date): Date => {
    const timeMatch = time.match(/(\d+):(\d+)\s*(AM|PM)/);
    if (!timeMatch) {
      throw new Error('Invalid time format');
    }

    const [, hours, minutes, period] = timeMatch;
    let hour = parseInt(hours);
    
    if (period === 'PM' && hour !== 12) {
      hour += 12;
    } else if (period === 'AM' && hour === 12) {
      hour = 0;
    }

    const bookingDate = new Date(date);
    bookingDate.setHours(hour, parseInt(minutes), 0, 0);
    return bookingDate;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedDate || !selectedTime) {
      setError(ERROR_MESSAGES.DATE_TIME_REQUIRED);
      return;
    }
    if (hasPendingBooking) {
      setError(ERROR_MESSAGES.PENDING_BOOKING_EXISTS);
      return;
    }
    // Enforce 3-hour rule before submitting
    if (!isTimeAllowedForSelectedDate(selectedDate, selectedTime, acceptedBookingsForDate)) {
      setError('This time slot is not available due to another accepted booking. Please select a different time.');
      return;
    }
    setIsSubmitting(true);
    clearMessages();
    try {
      const token = getAuthToken();
      const bookingDate = parseTimeToDate(selectedTime, selectedDate);
      const bookingData = {
        date: bookingDate.toISOString(),
        notes: notes.trim() || undefined
      };
      await axios.post(`${API_BASE_URL}/bookings`, bookingData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setSuccess('Booking created successfully!');
      resetForm();
      await fetchBookings();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 
                          err.request ? ERROR_MESSAGES.SERVER_ERROR : 
                          err.message || ERROR_MESSAGES.CREATE_ERROR;
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedDate, selectedTime, hasPendingBooking, notes, getAuthToken, parseTimeToDate, clearMessages, resetForm, fetchBookings, acceptedBookingsForDate]);

  // Effects
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    fetchBlockedDates();
  }, [fetchBlockedDates]);

  return {
    // State
    selectedDate,
    selectedTime,
    isTimeModalOpen,
    notes,
    isSubmitting,
    error,
    success,
    bookings,
    isLoadingBookings,
    hasPendingBooking,
    blockedDates,
    acceptedBookingsForDate,
    
    // Constants
    timeSlots: filteredTimeSlots,
    allTimeSlots: TIME_SLOTS,
    
    // Handlers
    handleDateSelect,
    handleTimeSelect,
    handleSubmit,
    setIsTimeModalOpen,
    setNotes,
    setTemporaryError,
  };
};
