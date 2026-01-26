import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useMediaDayBooking } from './CustomerMediaDayBookingLogic';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

// Types
interface MediaDayEvent extends Event {
  status: 'pending' | 'accepted' | 'declined';
}

// Constants
const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Status colors mapping
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  accepted: 'bg-green-100 text-green-800 border-green-200',
  declined: 'bg-red-100 text-red-800 border-red-200',
  default: 'bg-gray-100 text-gray-800 border-gray-200',
} as const;

// Event colors mapping
const EVENT_COLORS = {
  pending: '#fbbf24', // Yellow
  accepted: '#22c55e', // Green
  declined: '#f87171', // Red
  blocked: '#303b45', // Dark grey
} as const;

// Custom toolbar component
const CustomToolbar: React.FC<any> = (toolbar) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center space-x-4">
      <button
        onClick={() => toolbar.onNavigate('PREV')}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <ChevronLeftIcon className="w-6 h-6 text-[#303b45]" />
      </button>
      <button
        onClick={() => toolbar.onNavigate('NEXT')}
        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <ChevronRightIcon className="w-6 h-6 text-[#303b45]" />
      </button>
    </div>
    <h2 className="text-2xl font-semibold text-[#303b45]">
      {format(toolbar.date, 'MMMM yyyy')}
    </h2>
    <div className="w-24" />
  </div>
);

// Custom event dot component for calendar
const CalendarEventDot = ({ event }: { event: any }) => {
  let color = '';
  let tooltip = event.title;
  if (event.status === 'accepted') color = 'bg-green-500';
  else if (event.status === 'declined') color = 'bg-red-500';
  else if (event.status === 'blocked') color = 'bg-gray-500';
  else if (event.status === 'pending') color = 'bg-yellow-400';
  return (
    <div className="flex items-center justify-center h-full w-full" title={tooltip}>
      <span className={`inline-block w-3 h-3 rounded-full ${color}`}></span>
    </div>
  );
};

// Booking Card Component
const BookingCard: React.FC<{ booking: any; onCancel: (id: string) => void }> = ({ booking, onCancel }) => {
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  // Status pill color/icon
  let statusStyles = '';
  let statusIcon = null;
  if (booking.status === 'accepted') {
    statusStyles = 'bg-green-100 text-green-800 border-green-200';
    statusIcon = (
      <svg className="w-5 h-5 mr-1.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
      </svg>
    );
  } else if (booking.status === 'pending') {
    statusStyles = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    statusIcon = (
      <svg className="w-5 h-5 mr-1.5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  } else if (booking.status === 'declined') {
    statusStyles = 'bg-red-100 text-red-800 border-red-200';
    statusIcon = (
      <svg className="w-5 h-5 mr-1.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {formatDateTime(booking.date)}
          </h3>
          {booking.notes && (
            <p className="text-gray-600 mb-1">
              <span className="font-medium text-gray-700">Notes:</span> {booking.notes}
            </p>
          )}
          {booking.adminMessage && (
            <p className="text-gray-600">
              <span className="font-semibold text-blue-600">Clinimedia:</span> {booking.adminMessage}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className={`flex items-center px-4 py-2 rounded-full text-sm font-semibold border ${statusStyles}`}>
            {statusIcon}
            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          </div>
          {booking.status === 'pending' && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this booking request?')) {
                  onCancel(booking._id);
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const CustomerMediaDayBookingPage: React.FC = () => {
  const {
    selectedDate,
    selectedTime,
    isTimeModalOpen,
    timeSlots = [],
    allTimeSlots = [],
    acceptedBookingsForDate = [],
    notes = '',
    isSubmitting = false,
    error,
    success,
    bookings = [],
    isLoadingBookings = true,
    hasPendingBooking = false,
    blockedDates = [],
    nextEligibleDate,
    isLoadingEligibility = true,
    canBookImmediately = true,
    handleDateSelect,
    handleTimeSelect,
    handleSubmit,
    cancelBooking,
    setIsTimeModalOpen,
    setNotes,
    setTemporaryError,
  } = useMediaDayBooking();

  const [customer, setCustomer] = React.useState<any>(null);
  const [loadingCustomer, setLoadingCustomer] = React.useState(true);

  React.useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const token = localStorage.getItem('customerToken');
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCustomer(res.data);
      } catch (err) {
        setCustomer(null);
      } finally {
        setLoadingCustomer(false);
      }
    };
    fetchCustomer();
  }, []);

  // Next eligible date is now fetched from backend (source of truth)
  // No need to calculate it in frontend - use nextEligibleDate from hook

  // Utility functions
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  const getStatusColor = (status: string): string => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.default;
  };

  // Date checking functions
  const isBlocked = (date: Date): boolean => {
    // Safety check: ensure blockedDates is an array
    if (!Array.isArray(blockedDates)) return false;
    
    // Check if date is blocked
    const isDateBlocked = blockedDates.some(blocked => {
      if (!blocked) return false;
      const blockedDate = new Date(blocked);
      return blockedDate.getFullYear() === date.getFullYear() &&
        blockedDate.getMonth() === date.getMonth() &&
        blockedDate.getDate() === date.getDate();
    });
    
    // If date is blocked, check if this customer has an accepted booking on this date
    // If they do, allow them to see it (but still prevent new bookings)
    if (isDateBlocked) {
      // Safety check: ensure bookings is an array
      if (!Array.isArray(bookings)) return isDateBlocked;
      
      const hasOwnAcceptedBooking = bookings.some(booking => {
        if (!booking || booking.status !== 'accepted') return false;
        const bookingDate = new Date(booking.date);
        return bookingDate.getFullYear() === date.getFullYear() &&
          bookingDate.getMonth() === date.getMonth() &&
          bookingDate.getDate() === date.getDate();
      });
      
      // If they have their own accepted booking, don't treat it as "blocked" for UI purposes
      // (they can see it, but can't create a new one)
      if (hasOwnAcceptedBooking) {
        return false; // Allow them to see their booking
      }
    }
    
    return isDateBlocked;
  };

  const isDeclined = (date: Date): boolean => {
    // Safety check: ensure bookings is an array
    if (!Array.isArray(bookings)) return false;
    
    return bookings.some(booking => {
      if (!booking || booking.status !== 'declined') return false;
      const bookingDate = new Date(booking.date);
      return bookingDate.getFullYear() === date.getFullYear() &&
        bookingDate.getMonth() === date.getMonth() &&
        bookingDate.getDate() === date.getDate();
    });
  };

  const isAccepted = (date: Date): boolean => {
    // Safety check: ensure bookings is an array
    if (!Array.isArray(bookings)) return false;
    
    // Check if this customer has an accepted booking on this date
    const customerAccepted = bookings.some(booking => {
      if (!booking || booking.status !== 'accepted') return false;
      const bookingDate = new Date(booking.date);
      return bookingDate.getFullYear() === date.getFullYear() &&
        bookingDate.getMonth() === date.getMonth() &&
        bookingDate.getDate() === date.getDate();
    });
    
    // Also check if ANY customer has an accepted booking (from acceptedBookingsForDate)
    // This ensures we show the date as unavailable if another customer booked it
    const safeAcceptedBookings = Array.isArray(acceptedBookingsForDate) ? acceptedBookingsForDate : [];
    const anyAccepted = safeAcceptedBookings.length > 0;
    
    return customerAccepted || anyAccepted;
  };

  const isDateUnavailable = (date: Date): boolean => {
    return isBlocked(date) || isDeclined(date);
  };

  // Event handlers
  const handleCalendarSelect = ({ start }: { start: Date }): void => {
    // Safety check: ensure start is a valid date
    if (!start || !(start instanceof Date) || isNaN(start.getTime())) {
      console.error('Invalid date in handleCalendarSelect:', start);
      return;
    }
    
    // Check eligibility first (backend is source of truth, but check here for UX)
    if (!canBookImmediately && nextEligibleDate && start < nextEligibleDate) {
      const formattedDate = nextEligibleDate.toLocaleDateString('en-US', {
        timeZone: 'America/Toronto',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      setTemporaryError(`Not eligible until ${formattedDate}. Please select a date on or after that date.`);
      return;
    }
    
    // Safety check: ensure bookings is an array
    if (!Array.isArray(bookings)) {
      console.error('Bookings is not an array:', bookings);
      return;
    }
    
    // Check if this customer has their own accepted booking first
    const hasOwnAccepted = bookings.some(booking => {
      if (!booking || booking.status !== 'accepted') return false;
      const bookingDate = new Date(booking.date);
      return bookingDate.getFullYear() === start.getFullYear() &&
        bookingDate.getMonth() === start.getMonth() &&
        bookingDate.getDate() === start.getDate();
    });
    
    // If they have their own accepted booking, show message but don't allow new booking
    if (hasOwnAccepted) {
      setTemporaryError('You already have an accepted booking on this date. Only one media day per day allowed.');
      return;
    }
    
    // Check if date is blocked (by another customer's booking)
    if (isBlocked(start)) {
      setTemporaryError('This date is blocked and cannot be booked - already booked by another customer.');
      return;
    }
    if (isDeclined(start)) {
      setTemporaryError('You have a declined booking on this date and cannot book again.');
      return;
    }
    if (isAccepted(start)) {
      setTemporaryError('Media day already scheduled for the selected date');
      return;
    }
    handleDateSelect(start);
  };

  // Computed values
  const calendarEvents = useMemo(() => {
    // Safety check: ensure bookings is an array
    if (!Array.isArray(bookings)) return [];
    return bookings
      .filter(booking => booking && booking.date) // Filter out invalid bookings
      .map(booking => {
        try {
          const date = new Date(booking.date);
          // Validate date is not invalid
          if (isNaN(date.getTime())) {
            console.warn('Invalid booking date:', booking.date);
            return null;
          }
          return {
            id: booking._id,
            title: booking.status === 'accepted' ? '  Media Day!' : 
                   booking.status === 'declined' ? 'Declined' : 'Pending Media Day Request',
            start: date,
            end: new Date(date.getTime() + 60 * 60 * 1000),
            status: booking.status
          };
        } catch (err) {
          console.error('Error processing booking:', booking, err);
          return null;
        }
      })
      .filter(event => event !== null); // Remove null events
  }, [bookings]);

  const blockedDateEvents = useMemo(() => {
    // Safety check: ensure blockedDates is an array
    if (!Array.isArray(blockedDates)) return [];
    return blockedDates
      .filter(dateStr => dateStr) // Filter out empty strings
      .map(dateStr => {
        try {
          const date = new Date(dateStr);
          // Validate date is not invalid
          if (isNaN(date.getTime())) {
            console.warn('Invalid blocked date:', dateStr);
            return null;
          }
          return {
            id: `blocked-${dateStr}`,
            title: 'Date Blocked',
            start: date,
            end: new Date(date.getTime() + 60 * 60 * 1000),
            status: 'blocked',
            isBlocked: true,
          };
        } catch (err) {
          console.error('Error processing blocked date:', dateStr, err);
          return null;
        }
      })
      .filter(event => event !== null); // Remove null events
  }, [blockedDates]);

  const combinedEvents = useMemo(() => {
    // Safety check: ensure arrays are defined and valid
    const safeCalendarEvents = Array.isArray(calendarEvents) ? calendarEvents : [];
    const safeBlockedDateEvents = Array.isArray(blockedDateEvents) ? blockedDateEvents : [];
    // Ensure all events have valid start/end dates
    const validEvents = [...safeCalendarEvents, ...safeBlockedDateEvents].filter(event => {
      if (!event || !event.start || !event.end) return false;
      const start = event.start instanceof Date ? event.start : new Date(event.start);
      const end = event.end instanceof Date ? event.end : new Date(event.end);
      return !isNaN(start.getTime()) && !isNaN(end.getTime());
    });
    return validEvents;
  }, [calendarEvents, blockedDateEvents]);

  // Event styling
  const eventStyleGetter = (event: any) => {
    const backgroundColor = EVENT_COLORS[event.status as keyof typeof EVENT_COLORS] || EVENT_COLORS.pending;
    let color = 'white';
    if (event.status === 'pending') color = '#b45309';
    if (event.status === 'accepted') color = 'white';
    if (event.status === 'declined') color = 'white';
    if (event.status === 'blocked') color = 'white';
    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        opacity: 0.95,
        color,
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '0.95rem',
        minHeight: '24px',
        minWidth: '24px',
        padding: '2px 0',
        textAlign: 'center' as const,
      }
    };
  };

  // Day prop getter for calendar
  const dayPropGetter = (date: Date) => {
    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
    const unavailable = isDateUnavailable(date);
    // Disable dates before nextEligibleDate if set (from backend - source of truth)
    const beforeNextAllowed = !canBookImmediately && nextEligibleDate && date < nextEligibleDate;
    return {
      className: `${isPast ? 'rbc-off-range' : ''} ${unavailable || beforeNextAllowed ? 'bg-gray-200 cursor-not-allowed' : ''}`,
      onClick: (unavailable || beforeNextAllowed) ? (e: React.MouseEvent) => e.preventDefault() : undefined
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f9fafb] via-[#f3f4f6] to-[#e5e7eb] py-6 sm:py-8 md:py-10 overflow-x-hidden">
      <div className="max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 md:px-8 w-full">
        {/* Header */}
        <div className="text-center mb-12 relative flex flex-col items-center pt-8 pb-4">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-gray-500 via-gray-700 to-black bg-clip-text text-transparent drop-shadow font-sans tracking-tight flex items-center justify-center gap-2 leading-normal py-2">
            <span>Book Your Media Day!</span>
          </h1>
          {loadingCustomer ? (
            <div className="text-gray-500 text-sm mt-2">Loading your frequency...</div>
          ) : customer && (
            <div className="text-center mb-3 text-gray-700 font-medium">
              Your Media Day Frequency: {
                customer.bookingIntervalMonths === 1 ? 'Monthly (12 times per year)' :
                customer.bookingIntervalMonths === 2 ? '2 times per year (every 6 months)' :
                customer.bookingIntervalMonths === 3 ? '3 times per year (every 4 months)' :
                customer.bookingIntervalMonths === 4 ? '4 times per year (every 3 months)' :
                customer.bookingIntervalMonths === 6 ? '6 times per year (every 2 months)' :
                'Monthly'
              }
            </div>
          )}
          <p className="text-base md:text-lg font-normal text-gray-800 max-w-xl mx-auto px-6 py-4 mt-3 rounded-2xl shadow-xl backdrop-blur-md bg-white/60 border border-transparent">
          Make your clinic impossible to ignore. Book your next Media Day in just a few clicks. Lock in your date and time and let our team handle the rest. 
          </p>
        </div>
        
        {/* Messages */}
        {success && (
          <div className="mb-8 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        
        {/* Calendar */}
        <div className="bg-white rounded-xl shadow-xl p-3 mb-8 transform transition-all duration-300 hover:shadow-2xl relative border-8 border-[#e5e7eb]">
          {/* Booking Legend (top right corner) */}
          <div className="absolute top-6 right-8 flex flex-wrap gap-4 items-center justify-end z-10">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-400"></div>
              <span className="text-sm text-gray-700">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-sm text-gray-700">Accepted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500"></div>
              <span className="text-sm text-gray-700">Declined</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-800"></div>
              <span className="text-sm text-gray-700">Blocked</span>
            </div>
          </div>
          <div className="[&_.rbc-calendar]:bg-white [&_.rbc-calendar]:rounded-lg [&_.rbc-calendar]:p-4 [&_.rbc-calendar]:shadow-sm [&_.rbc-header]:bg-[#98c6d5] [&_.rbc-header]:text-white [&_.rbc-header]:font-semibold [&_.rbc-header]:py-3 [&_.rbc-today]:bg-gray-50 [&_.rbc-off-range-bg]:bg-gray-50 [&_.rbc-button-link]:text-[#303b45] [&_.rbc-button-link]:transition-colors [&_.rbc-day-bg]:transition-colors [&_.rbc-day-bg:hover]:bg-[#98c6d5] [&_.rbc-day-bg:hover]:bg-opacity-20 [&_.rbc-day-bg.rbc-off-range]:opacity-50 [&_.rbc-day-bg.rbc-off-range]:cursor-not-allowed [&_.rbc-day-bg.rbc-off-range]:hover:bg-transparent">
            {localizer && combinedEvents ? (
              <Calendar
                localizer={localizer}
                events={combinedEvents || []}
                startAccessor="start"
                endAccessor="end"
                style={{ height: 600 }}
                onSelectSlot={handleCalendarSelect}
                selectable
                views={['month']}
                className="rounded-lg"
                components={{ toolbar: CustomToolbar }}
                formats={{ monthHeaderFormat: () => '' }}
                eventPropGetter={eventStyleGetter}
                dayPropGetter={dayPropGetter}
              />
            ) : (
              <div className="flex items-center justify-center h-[600px]">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading calendar...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Booking Requests */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
              <svg className="w-6 h-6 mr-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Your Booking Requests
            </h2>
            <p className="text-gray-600">
              View and manage all your media day booking requests
            </p>
          </div>
          
          {isLoadingBookings ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your bookings...</p>
              </div>
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-600 text-lg">You haven't made any booking requests yet.</p>
              </div>
            </div>
          ) : (() => {
            // Sort bookings by most recent (using date as primary, then updatedAt/createdAt)
            const sortedBookings = [...bookings].sort((a, b) => {
              // First sort by date (most recent first)
              const aDate = new Date(a.date).getTime();
              const bDate = new Date(b.date).getTime();
              if (bDate !== aDate) {
                return bDate - aDate;
              }
              // If dates are equal, sort by updatedAt/createdAt
              const aTime = new Date(a.updatedAt || a.createdAt || a.date).getTime();
              const bTime = new Date(b.updatedAt || b.createdAt || b.date).getTime();
              return bTime - aTime;
            });

            // Group bookings by status
            const pendingBookings = sortedBookings.filter(b => b.status === 'pending');
            const acceptedBookings = sortedBookings.filter(b => b.status === 'accepted');
            const declinedBookings = sortedBookings.filter(b => b.status === 'declined');

            return (
              <div className="space-y-8">
                {/* Pending Bookings */}
                {pendingBookings.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="bg-yellow-100 p-2 rounded-lg mr-3">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      Pending Requests ({pendingBookings.length})
                    </h3>
                    <div className="space-y-4">
                      {pendingBookings.map((booking) => (
                        <BookingCard key={booking._id} booking={booking} onCancel={cancelBooking} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Accepted Bookings */}
                {acceptedBookings.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="bg-green-100 p-2 rounded-lg mr-3">
                        <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      Accepted Bookings ({acceptedBookings.length})
                    </h3>
                    <div className="space-y-4">
                      {acceptedBookings.map((booking) => (
                        <BookingCard key={booking._id} booking={booking} onCancel={cancelBooking} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Declined Bookings */}
                {declinedBookings.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="bg-red-100 p-2 rounded-lg mr-3">
                        <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                      Declined Requests ({declinedBookings.length})
                    </h3>
                    <div className="space-y-4">
                      {declinedBookings.map((booking) => (
                        <BookingCard key={booking._id} booking={booking} onCancel={cancelBooking} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Time Selection Modal */}
        {isTimeModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-8 max-w-md w-full transform transition-all duration-300 scale-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-[#303b45]">
                  Select Time for {selectedDate?.toLocaleDateString('en-US', { 
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </h2>
                <button
                  onClick={() => setIsTimeModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-8">
                {allTimeSlots.map((slot) => {
                  const isAvailable = timeSlots.some(ts => ts.time === slot.time);
                  return (
                    <button
                      key={slot.id}
                      onClick={() => isAvailable && handleTimeSelect(slot.time)}
                      disabled={!isAvailable || isSubmitting}
                      className={`p-4 rounded-lg text-center transition-all duration-200 transform ${
                        selectedTime === slot.time && isAvailable
                          ? 'bg-[#98c6d5] text-white shadow-lg'
                          : isAvailable
                            ? 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>

              <div className="mb-8">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                  className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#98c6d5] focus:border-[#98c6d5] transition-colors resize-none text-gray-900 ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  placeholder="Add any additional information or special requests..."
                />
              </div>

              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setIsTimeModalOpen(false)}
                  disabled={isSubmitting}
                  className={`px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedTime || isSubmitting}
                  className={`px-6 py-2 bg-[#98c6d5] text-white rounded-lg hover:bg-[#7bb3c4] transition-colors font-medium ${
                    !selectedTime || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Booking'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerMediaDayBookingPage;