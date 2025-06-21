import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../../utils/api';
import type { DateObject } from 'react-multi-date-picker';

// Types
interface Booking {
  _id: string;
  date: string;
  notes: string;
  status: 'pending' | 'accepted' | 'declined';
  customer: {
    name: string;
    email: string;
  };
}

interface BlockedDateEvent {
  id: string;
  date: string;
  customers: { label: string; value: string }[];
  allCustomers: boolean;
}

interface Customer {
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
} as const;

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
      setBlockedDatesEvents(
        response.data.map((block: any) => ({
          id: block._id,
          date: block.date,
          customers: [],
          allCustomers: true,
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
      for (const date of dates) {
        await axios.post(
          `${API_BASE_URL}/blocked-dates`,
          { date: date.toDate().toISOString() },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      await fetchBlockedDates();
    } catch (err) {
      setError('Failed to block dates');
    }
  }, [getAuthToken, fetchBlockedDates]);

  const createBookingForCustomer = useCallback(async (customerId: string, date: Date, notes?: string) => {
    try {
      setIsCreatingBooking(true);
      const token = getAuthToken();

      const response = await axios.post(
        `${API_BASE_URL}/bookings/admin-create`,
        {
          customerId,
          date: date.toISOString(),
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

  // Effects
  useEffect(() => {
    fetchBookings();
    fetchBlockedDates();
    fetchCustomers();
  }, [fetchBookings, fetchBlockedDates, fetchCustomers]);

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
    isCreatingBooking,
    
    // Handlers
    handleAcceptRequest,
    handleDenyRequest,
    openDenyModal,
    openAcceptModal,
    setIsDenyModalOpen,
    setIsAcceptModalOpen,
    addBlockedDates,
    createBookingForCustomer,
  };
};
