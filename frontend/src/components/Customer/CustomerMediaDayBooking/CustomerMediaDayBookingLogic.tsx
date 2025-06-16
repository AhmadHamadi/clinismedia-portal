import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../../utils/api';

export interface TimeSlot {
  id: string;
  time: string;
  isAvailable: boolean;
}

export interface Booking {
  _id: string;
  date: string;
  notes?: string;
  status: 'pending' | 'accepted' | 'declined';
}

export const useMediaDayBooking = () => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  // Fetch customer's bookings
  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) {
        throw new Error('You must be logged in to view bookings');
      }

      const response = await axios.get(`${API_BASE_URL}/bookings/my-bookings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setBookings(response.data);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      setError('Failed to load bookings');
    } finally {
      setIsLoadingBookings(false);
    }
  };

  // Fetch bookings on component mount
  useEffect(() => {
    fetchBookings();
  }, []);

  // Generate time slots from 8 AM to 4 PM
  const timeSlots = [
    { id: 1, time: '10:00 AM' },
    { id: 2, time: '11:00 AM' },
    { id: 3, time: '12:00 PM' },
    { id: 4, time: '1:00 PM' },
    { id: 5, time: '2:00 PM' },
  ];

  const handleDateSelect = (date: Date) => {
    // Check if the date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    
    if (date < today) {
      return; // Don't allow selection of past dates
    }
    
    setSelectedDate(date);
    setIsTimeModalOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      setError('Please select both a date and time');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Get the customer token
      const token = localStorage.getItem('customerToken');
      if (!token) {
        throw new Error('You must be logged in to create a booking');
      }

      // Combine date and time into a single datetime
      const [hours, minutes, period] = selectedTime.match(/(\d+):(\d+)\s*(AM|PM)/)?.slice(1) || [];
      const hour = parseInt(hours) + (period === 'PM' && hours !== '12' ? 12 : 0);
      const bookingDate = new Date(selectedDate);
      bookingDate.setHours(hour, parseInt(minutes), 0, 0);

      // Create the booking data
      const bookingData = {
        date: bookingDate.toISOString(),
        notes: notes.trim() || undefined
      };

      console.log('Sending booking request:', bookingData);

      const response = await axios.post(`${API_BASE_URL}/bookings`, bookingData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Booking created:', response.data);
      setSuccess('Booking created successfully!');
      
      // Reset form
      setSelectedDate(null);
      setSelectedTime(null);
      setNotes('');
      setIsTimeModalOpen(false);

      // Refresh bookings list
      await fetchBookings();
    } catch (err: any) {
      console.error('Error creating booking:', err);
      if (err.response) {
        setError(err.response.data.message || 'Failed to create booking');
      } else if (err.request) {
        setError('No response from server. Please check if the server is running.');
      } else {
        setError(err.message || 'Failed to create booking');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    selectedDate,
    selectedTime,
    isTimeModalOpen,
    timeSlots,
    notes,
    isSubmitting,
    error,
    success,
    bookings,
    isLoadingBookings,
    handleDateSelect,
    handleTimeSelect,
    handleSubmit,
    setIsTimeModalOpen,
    setNotes
  };
};
