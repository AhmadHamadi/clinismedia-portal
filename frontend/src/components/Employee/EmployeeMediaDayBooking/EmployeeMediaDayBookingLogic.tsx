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
  employeeMessage?: string;
  photographer?: {
    _id: string;
    name: string;
    email: string;
  } | null;
  customer: {
    name: string;
    email: string;
    location?: string;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: 'pending' | 'accepted';
}

// Constants
const ERROR_MESSAGES = {
  NO_TOKEN: 'No authentication token found',
  FETCH_ERROR: 'Failed to fetch bookings',
  ACCEPT_ERROR: 'Failed to accept session',
} as const;

export const useEmployeeMediaDayBooking = () => {
  // State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAcceptingSession, setIsAcceptingSession] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);

  // Utility functions
  const getAuthToken = useCallback((): string => {
    const token = localStorage.getItem('employeeToken');
    if (!token) {
      throw new Error(ERROR_MESSAGES.NO_TOKEN);
    }
    return token;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get current employee ID from token
  const getCurrentEmployeeId = useCallback((): string | null => {
    try {
      const token = getAuthToken();
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.sub || payload.id || payload._id || payload.user?.id || payload.user?._id || null;
    } catch (err) {
      return null;
    }
  }, [getAuthToken]);

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = getAuthToken();
      const response = await axios.get<Booking[]>(`${API_BASE_URL}/bookings/employee`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setBookings(response.data);
      setCurrentEmployeeId(getCurrentEmployeeId());
    } catch (err: any) {
      setError(err.response?.data?.message || ERROR_MESSAGES.FETCH_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken, getCurrentEmployeeId]);

  // Accept photography session
  const acceptSession = useCallback(async (bookingId: string) => {
    try {
      setIsAcceptingSession(true);
      const token = getAuthToken();
      
      await axios.patch(
        `${API_BASE_URL}/bookings/${bookingId}/accept-session`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await fetchBookings();
    } catch (err: any) {
      setError(err.response?.data?.message || ERROR_MESSAGES.ACCEPT_ERROR);
      throw err;
    } finally {
      setIsAcceptingSession(false);
    }
  }, [getAuthToken, fetchBookings]);

  // Computed values - filter based on current employee
  const acceptedBookings = useMemo(() => 
    bookings.filter(booking => 
      booking.status === 'accepted' && 
      booking.photographer?._id === currentEmployeeId
    ), 
    [bookings, currentEmployeeId]
  );

  const availableBookings = useMemo(() => 
    bookings.filter(booking => 
      booking.status === 'accepted' && 
      !booking.photographer
    ), 
    [bookings]
  );

  const calendarEvents = useMemo((): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    
    acceptedBookings.forEach(booking => {
      const date = new Date(booking.date);
      events.push({
        id: `accepted-${booking._id}`,
        title: `${booking.customer.name} - Accepted`,
        start: date,
        end: new Date(date.getTime() + 60 * 60 * 1000),
        status: 'accepted'
      });
    });
    
    availableBookings.forEach(booking => {
      const date = new Date(booking.date);
      events.push({
        id: `available-${booking._id}`,
        title: `${booking.customer.name} - Available`,
        start: date,
        end: new Date(date.getTime() + 60 * 60 * 1000),
        status: 'pending'
      });
    });
    
    return events;
  }, [acceptedBookings, availableBookings]);

  // Effects
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return {
    // State
    bookings,
    acceptedBookings,
    availableBookings,
    isLoading,
    error,
    isAcceptingSession,
    currentEmployeeId,
    
    // Computed values
    calendarEvents,
    
    // Handlers
    clearError,
    fetchBookings,
    acceptSession,
  };
};
