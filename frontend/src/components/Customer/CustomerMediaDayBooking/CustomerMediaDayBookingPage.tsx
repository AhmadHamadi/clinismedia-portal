import React, { useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useMediaDayBooking } from './CustomerMediaDayBookingLogic';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

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

const CustomerMediaDayBookingPage: React.FC = () => {
  const {
    selectedDate,
    selectedTime,
    isTimeModalOpen,
    timeSlots,
    allTimeSlots,
    acceptedBookingsForDate,
    notes,
    isSubmitting,
    error,
    success,
    bookings,
    isLoadingBookings,
    hasPendingBooking,
    blockedDates,
    handleDateSelect,
    handleTimeSelect,
    handleSubmit,
    setIsTimeModalOpen,
    setNotes,
    setTemporaryError,
  } = useMediaDayBooking();

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
    return blockedDates.some(blocked => {
      const blockedDate = new Date(blocked);
      return blockedDate.getFullYear() === date.getFullYear() &&
        blockedDate.getMonth() === date.getMonth() &&
        blockedDate.getDate() === date.getDate();
    });
  };

  const isDeclined = (date: Date): boolean => {
    return bookings.some(booking => {
      if (booking.status !== 'declined') return false;
      const bookingDate = new Date(booking.date);
      return bookingDate.getFullYear() === date.getFullYear() &&
        bookingDate.getMonth() === date.getMonth() &&
        bookingDate.getDate() === date.getDate();
    });
  };

  const isAccepted = (date: Date): boolean => {
    return bookings.some(booking => {
      if (booking.status !== 'accepted') return false;
      const bookingDate = new Date(booking.date);
      return bookingDate.getFullYear() === date.getFullYear() &&
        bookingDate.getMonth() === date.getMonth() &&
        bookingDate.getDate() === date.getDate();
    });
  };

  const isDateUnavailable = (date: Date): boolean => {
    return isBlocked(date) || isDeclined(date);
  };

  // Event handlers
  const handleCalendarSelect = ({ start }: { start: Date }): void => {
    if (isBlocked(start)) {
      setTemporaryError('This date is blocked and cannot be booked.');
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
  const calendarEvents = useMemo(() => 
    bookings.map(booking => {
      const date = new Date(booking.date);
      return {
        id: booking._id,
        title: booking.status === 'accepted' ? '  Media Day!' : 
               booking.status === 'declined' ? 'Declined' : 'Pending Media Day Request',
        start: date,
        end: new Date(date.getTime() + 60 * 60 * 1000),
        status: booking.status
      };
    }), [bookings]
  );

  const blockedDateEvents = useMemo(() => 
    blockedDates.map(dateStr => {
      const date = new Date(dateStr);
      return {
        id: `blocked-${dateStr}`,
        title: 'Date Blocked',
        start: date,
        end: new Date(date.getTime() + 60 * 60 * 1000),
        status: 'blocked',
        isBlocked: true,
      };
    }), [blockedDates]
  );

  const combinedEvents = useMemo(() => 
    [...calendarEvents, ...blockedDateEvents], 
    [calendarEvents, blockedDateEvents]
  );

  // Event styling
  const eventStyleGetter = (event: any) => {
    const backgroundColor = EVENT_COLORS[event.status as keyof typeof EVENT_COLORS] || EVENT_COLORS.pending;
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        textAlign: 'center' as const,
        padding: '2px 0',
        fontWeight: event.isBlocked ? 700 : 500,
        fontSize: event.isBlocked ? '1rem' : undefined,
      }
    };
  };

  // Day prop getter for calendar
  const dayPropGetter = (date: Date) => {
    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
    const unavailable = isDateUnavailable(date);
    
    return {
      className: `${isPast ? 'rbc-off-range' : ''} ${unavailable ? 'bg-gray-200 cursor-not-allowed' : ''}`,
      onClick: unavailable ? (e: React.MouseEvent) => e.preventDefault() : undefined
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#303b45] mb-4">Book Your Media Day</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Select your preferred date and time for your media day. We'll confirm your booking and send you all the details.
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
        
        {/* Booking Legend */}
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-center">
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

        {/* Calendar */}
        <div className="bg-white rounded-xl shadow-xl p-8 mb-8 transform transition-all duration-300 hover:shadow-2xl">
          <div className="[&_.rbc-calendar]:bg-white [&_.rbc-calendar]:rounded-lg [&_.rbc-calendar]:p-4 [&_.rbc-calendar]:shadow-sm [&_.rbc-header]:bg-[#98c6d5] [&_.rbc-header]:text-white [&_.rbc-header]:font-semibold [&_.rbc-header]:py-3 [&_.rbc-today]:bg-gray-50 [&_.rbc-off-range-bg]:bg-gray-50 [&_.rbc-button-link]:text-[#303b45] [&_.rbc-button-link]:transition-colors [&_.rbc-day-bg]:transition-colors [&_.rbc-day-bg:hover]:bg-[#98c6d5] [&_.rbc-day-bg:hover]:bg-opacity-20 [&_.rbc-day-bg.rbc-off-range]:opacity-50 [&_.rbc-day-bg.rbc-off-range]:cursor-not-allowed [&_.rbc-day-bg.rbc-off-range]:hover:bg-transparent">
            <Calendar
              localizer={localizer}
              events={combinedEvents}
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
          </div>
        </div>

        {/* Booking Requests */}
        <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-[#303b45] mb-6">Your Booking Requests</h2>
          
          {isLoadingBookings ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#98c6d5] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading your bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">You haven't made any booking requests yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <div key={booking._id} className="border rounded-lg p-6 transition-all duration-200 hover:shadow-md">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-[#303b45]">
                        {formatDateTime(booking.date)}
                      </h3>
                      {booking.notes && (
                        <p className="mt-2 text-gray-600">Notes: {booking.notes}</p>
                      )}
                      {booking.status === 'declined' && booking.denialReason && (
                        <p className="mt-2 text-red-600">Reason for decline: {booking.denialReason}</p>
                      )}
                    </div>
                    <div className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(booking.status)}`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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

              {/* DEBUG OUTPUT - REMOVE AFTER TESTING */}
              <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                <div><strong>Selected Date:</strong> {selectedDate?.toISOString() || 'none'}</div>
                <div><strong>Accepted bookings for this date (all customers):</strong></div>
                <ul>
                  {acceptedBookingsForDate.map(b => (
                    <li key={b._id}>
                      raw: {b.date} | local: {new Date(b.date).toString()} | hour: {new Date(b.date).getHours()}
                    </li>
                  ))}
                </ul>
                <div><strong>Enabled slots:</strong> {timeSlots.map(ts => ts.time).join(', ')}</div>
                <div><strong>All slots:</strong></div>
                <ul>
                  {allTimeSlots.map(slot => {
                    const slotHour = (() => {
                      const [raw, period] = slot.time.split(' ');
                      let [hour, minute] = raw.split(':').map(Number);
                      if (period === 'PM' && hour !== 12) hour += 12;
                      if (period === 'AM' && hour === 12) hour = 0;
                      return hour;
                    })();
                    const isEnabled = timeSlots.some(ts => ts.time === slot.time);
                    return (
                      <li key={slot.id}>
                        {slot.time} | hour: {slotHour} | enabled: {isEnabled ? 'yes' : 'no'}
                      </li>
                    );
                  })}
                </ul>
                <div><strong>All bookings (debug):</strong></div>
                <ul>
                  {bookings.map(b => (
                    <li key={b._id}>
                      raw: {b.date} | local: {new Date(b.date).toString()} | selected: {selectedDate?.toString() || 'none'} | isSameDate: {selectedDate ? (new Date(b.date).getFullYear() === selectedDate.getFullYear() && new Date(b.date).getMonth() === selectedDate.getMonth() && new Date(b.date).getDate() === selectedDate.getDate() ? 'yes' : 'no') : 'n/a'} | status: {b.status}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setIsTimeModalOpen(false)}
                  disabled={isSubmitting}
                  className={`px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors font-medium ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedTime || isSubmitting || !timeSlots.some(ts => ts.time === selectedTime)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 ${
                    selectedTime && !isSubmitting && timeSlots.some(ts => ts.time === selectedTime)
                      ? 'bg-[#98c6d5] text-white hover:bg-[#7ab4c3] shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? 'Creating Booking...' : 'Confirm Booking'}
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