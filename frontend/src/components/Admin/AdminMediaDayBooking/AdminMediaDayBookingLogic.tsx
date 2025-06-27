import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../../utils/api';
import type { DateObject } from 'react-multi-date-picker';

// Types
export interface Booking {
  _id: string;
  date: string;
  notes: string;
  status: 'pending' | 'accepted' | 'declined';
  customer: {
    name: string;
    email: string;
  };
}

export interface BlockedDateEvent {
  id: string;
  date: string;
  customers: { label: string; value: string }[];
  allCustomers: boolean;
  bookingId?: string;
  isManualBlock: boolean;
  booking?: {
    customer: {
      name: string;
      email: string;
    };
    status: string;
  };
}

export interface Customer {
  _id: string;
  name: string;
  email: string;
  username?: string;
}

// Constants
const ERROR_MESSAGES = {
  NO_TOKEN: 'No authentication token found',
  FETCH_BOOKINGS_ERROR: 'Failed to fetch bookings',
  ACCEPT_BOOKING_ERROR: 'Failed to accept booking',
  DECLINE_BOOKING_ERROR: 'Failed to decline booking',
  CREATE_BOOKING_ERROR: 'Failed to create booking',
  FETCH_CUSTOMERS_ERROR: 'Failed to fetch customers',
  UNBLOCK_DATES_ERROR: 'Failed to unblock dates',
  BLOCK_DATES_ERROR: 'Failed to block dates',
} as const;

// Utility functions
const formatDateString = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const isDateAlreadyBlocked = (date: Date, blockedDates: BlockedDateEvent[]): boolean => {
  const dateString = formatDateString(date);
  return blockedDates.some(block => formatDateString(new Date(block.date)) === dateString);
};

const TIME_SLOTS = [
  { id: 1, time: '10:00 AM' },
  { id: 2, time: '11:00 AM' },
  { id: 3, time: '12:00 PM' },
  { id: 4, time: '1:00 PM' },
  { id: 5, time: '2:00 PM' },
];

export const useAdminMediaDayBooking = () => {
  // State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isDenyModalOpen, setIsDenyModalOpen] = useState(false);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [denialReason, setDenialReason] = useState('');
  const [showPriorRequests, setShowPriorRequests] = useState(false);
  const [blockedDatesEvents, setBlockedDatesEvents] = useState<BlockedDateEvent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [isUnblockModalOpen, setIsUnblockModalOpen] = useState(false);
  const [selectedBlockedDates, setSelectedBlockedDates] = useState<string[]>([]);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [acceptedBookingsForDate, setAcceptedBookingsForDate] = useState<any[]>([]);
  const [selectedDateForBooking, setSelectedDateForBooking] = useState<Date | null>(null);
  const [selectedCustomerForBooking, setSelectedCustomerForBooking] = useState<any>(null);
  const [selectedTimeForBooking, setSelectedTimeForBooking] = useState<string | null>(null);

  // Utility functions
  const getAuthToken = useCallback(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      throw new Error(ERROR_MESSAGES.NO_TOKEN);
    }
    return token;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetModalState = useCallback(() => {
    setSelectedBooking(null);
    setDenialReason('');
    setIsDenyModalOpen(false);
    setIsAcceptModalOpen(false);
  }, []);

  // API calls
  const fetchCustomers = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get(`${API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data);
    } catch (err) {
      setError(ERROR_MESSAGES.FETCH_CUSTOMERS_ERROR);
    }
  }, [getAuthToken]);

  const fetchBlockedDates = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await axios.get(`${API_BASE_URL}/blocked-dates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Filter out blocked dates that correspond to accepted bookings
      // Admin should see accepted bookings as accepted, not as blocked dates
      const filteredBlockedDates = response.data.filter((block: any) => {
        // If it's a booking-based block, check if the booking is accepted
        if (block.bookingId && block.bookingId.status) {
          // Only include blocked dates for non-accepted bookings (like declined bookings)
          // or manual blocks
          return block.bookingId.status !== 'accepted';
        }
        
        // Include manual blocks (they affect everyone)
        return true;
      });
      
      setBlockedDatesEvents(
        filteredBlockedDates.map((block: any) => ({
          id: block._id,
          date: block.date,
          customers: [],
          allCustomers: true,
          bookingId: block.bookingId,
          isManualBlock: block.isManualBlock,
          booking: block.bookingId ? {
            customer: block.bookingId.customer,
            status: block.bookingId.status
          } : undefined,
        }))
      );
    } catch (err) {
      // Silently fail for blocked dates as it's not critical
    }
  }, [getAuthToken]);

  const fetchBookings = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = getAuthToken();
      const response = await axios.get(`${API_BASE_URL}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
      clearError();
    } catch (err) {
      setError(ERROR_MESSAGES.FETCH_BOOKINGS_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken, clearError]);

  const addBlockedDates = useCallback(async (dates: DateObject[]) => {
    try {
      const token = getAuthToken();
      
      // Check for dates that are already blocked
      const datesToBlock = dates.filter(date => !isDateAlreadyBlocked(date.toDate(), blockedDatesEvents));
      
      if (datesToBlock.length === 0) {
        setError('All selected dates are already blocked');
        return;
      }
      
      if (datesToBlock.length < dates.length) {
        setError(`Some dates were already blocked. Only ${datesToBlock.length} new date(s) will be blocked.`);
      }
      
      for (const date of datesToBlock) {
        await axios.post(
          `${API_BASE_URL}/blocked-dates`,
          { date: date.toDate().toISOString() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      await fetchBlockedDates();
    } catch (err) {
      setError(ERROR_MESSAGES.BLOCK_DATES_ERROR);
    }
  }, [getAuthToken, fetchBlockedDates, blockedDatesEvents]);

  const unblockDates = useCallback(async (dateIds: string[]) => {
    try {
      setIsUnblocking(true);
      const token = getAuthToken();
      
      // Delete each blocked date individually
      for (const dateId of dateIds) {
        await axios.delete(
          `${API_BASE_URL}/blocked-dates/${dateId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      await fetchBlockedDates();
      setSelectedBlockedDates([]);
      setIsUnblockModalOpen(false);
    } catch (err) {
      setError(ERROR_MESSAGES.UNBLOCK_DATES_ERROR);
    } finally {
      setIsUnblocking(false);
    }
  }, [getAuthToken, fetchBlockedDates]);

  const fetchAcceptedBookingsForDate = useCallback(async (date: Date | null) => {
    if (!date) {
      setAcceptedBookingsForDate([]);
      return;
    }
    try {
      const token = getAuthToken();
      const dateString = date.toISOString().split('T')[0];
      const response = await axios.get(`${API_BASE_URL}/bookings/accepted?date=${dateString}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAcceptedBookingsForDate(response.data);
    } catch (err) {
      setAcceptedBookingsForDate([]);
    }
  }, [getAuthToken]);

  const getHourFromTimeString = (time: string): number => {
    const [raw, period] = time.split(' ');
    let [hour, minute] = raw.split(':').map(Number);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return hour;
  };

  const getHourFromDate = (date: string): number => new Date(date).getHours();

  const timeSlots = useMemo(() => {
    if (!selectedDateForBooking) return TIME_SLOTS;
    if (acceptedBookingsForDate.length === 0) return TIME_SLOTS;
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
  }, [selectedDateForBooking, acceptedBookingsForDate]);

  useEffect(() => {
    fetchBookings();
    fetchBlockedDates();
    fetchCustomers();
  }, [fetchBookings, fetchBlockedDates, fetchCustomers]);

  useEffect(() => {
    fetchAcceptedBookingsForDate(selectedDateForBooking);
  }, [selectedDateForBooking, fetchAcceptedBookingsForDate]);

  const createBookingForCustomer = useCallback(async (customerId: string, date: Date, time: string, notes?: string) => {
    try {
      setIsCreatingBooking(true);
      const token = getAuthToken();
      // Combine date and time
      const [raw, period] = time.split(' ');
      let [hour, minute] = raw.split(':').map(Number);
      if (period === 'PM' && hour !== 12) hour += 12;
      if (period === 'AM' && hour === 12) hour = 0;
      const bookingDate = new Date(date);
      bookingDate.setHours(hour, minute, 0, 0);
      const response = await axios.post(
        `${API_BASE_URL}/bookings/admin-create`,
        {
          customerId,
          date: bookingDate.toISOString(),
          notes: notes || ''
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      await fetchBookings();
      return response.data;
    } catch (err) {
      setError(ERROR_MESSAGES.CREATE_BOOKING_ERROR);
      throw err;
    } finally {
      setIsCreatingBooking(false);
    }
  }, [getAuthToken, fetchBookings]);

  // Event handlers
  const handleAcceptRequest = useCallback(async (bookingId: string) => {
    try {
      const token = getAuthToken();
      await axios.patch(
        `${API_BASE_URL}/bookings/${bookingId}/status`,
        { status: 'accepted' },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      await fetchBookings();
      resetModalState();
    } catch (err) {
      setError(ERROR_MESSAGES.ACCEPT_BOOKING_ERROR);
    }
  }, [getAuthToken, fetchBookings, resetModalState]);

  const handleDenyRequest = useCallback(async (bookingId: string) => {
    if (!denialReason.trim()) return;

    try {
      const token = getAuthToken();
      await axios.patch(
        `${API_BASE_URL}/bookings/${bookingId}/status`,
        { 
          status: 'declined',
          denialReason 
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      await fetchBookings();
      resetModalState();
    } catch (err) {
      setError(ERROR_MESSAGES.DECLINE_BOOKING_ERROR);
    }
  }, [denialReason, getAuthToken, fetchBookings, resetModalState]);

  const openDenyModal = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setIsDenyModalOpen(true);
  }, []);

  const openAcceptModal = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setIsAcceptModalOpen(true);
  }, []);

  // Computed values
  const filteredBookings = useMemo(() => 
    bookings.filter(booking => 
      showPriorRequests 
        ? booking.status !== 'pending'  // Show accepted/declined bookings
        : booking.status === 'pending'  // Show pending bookings
    ), [bookings, showPriorRequests]
  );

  const calendarEvents = useMemo(() => 
    bookings
      .filter(booking => booking.status !== 'declined') // Only show pending and accepted bookings
      .map(booking => {
        const date = new Date(booking.date);
        return {
          id: booking._id,
          title: `${booking.customer.name} - ${booking.status}`,
          start: date,
          end: new Date(date.getTime() + 60 * 60 * 1000), // 1 hour duration
          status: booking.status
        };
      }), [bookings]
  );

  const customerOptions = useMemo(() => 
    customers.map(customer => ({
      value: customer._id,
      label: customer.name
    })), [customers]
  );

  return {
    // State
    bookings: filteredBookings,
    calendarEvents,
    isLoading,
    error,
    isDenyModalOpen,
    isAcceptModalOpen,
    selectedBooking,
    setSelectedBooking,
    denialReason,
    setDenialReason,
    showPriorRequests,
    setShowPriorRequests,
    blockedDatesEvents,
    customers,
    customerOptions,
    isCreatingBooking,
    isUnblockModalOpen,
    setIsUnblockModalOpen,
    selectedBlockedDates,
    setSelectedBlockedDates,
    isUnblocking,
    acceptedBookingsForDate,
    selectedDateForBooking,
    setSelectedDateForBooking,
    selectedCustomerForBooking,
    setSelectedCustomerForBooking,
    selectedTimeForBooking,
    setSelectedTimeForBooking,
    timeSlots,
    allTimeSlots: TIME_SLOTS,
    
    // Handlers
    handleAcceptRequest,
    handleDenyRequest,
    openDenyModal,
    openAcceptModal,
    setIsDenyModalOpen,
    setIsAcceptModalOpen,
    addBlockedDates,
    unblockDates,
    createBookingForCustomer,
  };
};
