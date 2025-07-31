import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import type { Booking } from "../EmployeeMediaDayBooking/EmployeeMediaDayBookingLogic";

export interface Employee {
  _id: string;
  name: string;
  email: string;
  username: string;
  department: string;
}

export const useEmployeeDashboard = () => {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);

  // Utility to get employee ID from token
  const getAuthToken = useCallback((): string => {
    const token = localStorage.getItem('employeeToken');
    if (!token) throw new Error('No authentication token found');
    return token;
  }, []);

  const getCurrentEmployeeId = useCallback((): string | null => {
    try {
      const token = getAuthToken();
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.sub || payload.id || payload._id || payload.user?.id || payload.user?._id || null;
    } catch (err) {
      return null;
    }
  }, [getAuthToken]);

  // Fetch employee's accepted bookings
  const fetchBookings = useCallback(async () => {
    try {
      setIsLoadingBookings(true);
      const token = getAuthToken();
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/bookings/employee`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
      setCurrentEmployeeId(getCurrentEmployeeId());
    } catch (err) {
      // Optionally handle error
    } finally {
      setIsLoadingBookings(false);
    }
  }, [getAuthToken, getCurrentEmployeeId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Show accepted bookings for this employee in the future, or unassigned accepted bookings
  const acceptedBookings = useMemo(() => {
    const now = new Date();
    return bookings.filter(booking => {
      const isAccepted = booking.status === 'accepted';
      const isInFuture = new Date(booking.date) > now;
      const isAssignedToMe = booking.photographer && booking.photographer._id === currentEmployeeId;
      const isUnassigned = !booking.photographer; // Show unassigned accepted bookings too
      
      return isAccepted && isInFuture && (isAssignedToMe || isUnassigned);
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [bookings, currentEmployeeId]);

  // Count available bookings for notification badge
  const availableBookingsCount = useMemo(() => {
    const now = new Date();
    return bookings.filter(booking => {
      const isAccepted = booking.status === 'accepted';
      const isInFuture = new Date(booking.date) > now;
      const isUnassigned = !booking.photographer; // Only count unassigned bookings
      
      return isAccepted && isInFuture && isUnassigned;
    }).length;
  }, [bookings]);

  const fetchEmployeeData = async () => {
    try {
      const token = localStorage.getItem("employeeToken");
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/employees/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setEmployee(response.data);
      setLoading(false);
    } catch (err: any) {
      console.error("Failed to fetch employee data:", err);
      setError("Failed to load employee data. Please try again.");
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("employeeToken");
    localStorage.removeItem("employeeData");
  };

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  return {
    employee,
    loading,
    error,
    handleLogout,
    acceptedBookings,
    isLoadingBookings,
    availableBookingsCount,
  };
};
