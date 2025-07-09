import React, { useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useEmployeeMediaDayBooking, type Booking } from './EmployeeMediaDayBookingLogic';

// Types
interface MediaDayEvent extends Event {
  status: 'pending' | 'accepted';
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

// Event colors mapping
const EVENT_COLORS = {
  pending: '#60a5fa', // Soft blue
  accepted: '#22c55e', // Green
} as const;

// Icons
const Icons = {
  calendar: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  clock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  user: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  email: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 012.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  check: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  empty: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  location: (props: React.SVGProps<SVGSVGElement>) => (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.643 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  ),
};

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

// Booking card component
const BookingCard: React.FC<{
  booking: Booking;
  showAcceptButton?: boolean;
  onAccept?: (bookingId: string) => void;
  isAccepting?: boolean;
}> = ({ booking, showAcceptButton = false, onAccept, isAccepting = false }) => (
  <div className="bg-gray-50 rounded-2xl shadow-lg px-8 py-6 flex flex-col transition-all duration-200 hover:shadow-2xl">
    <div>
      <h3 className="text-xl font-semibold text-[#303b45] mb-2">
        {booking.customer.name}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-600">
        <div className="flex items-center gap-2">
          <Icons.calendar className="w-5 h-5 text-[#98c6d5]" />
          <span>{format(new Date(booking.date), 'EEEE, MMMM d, yyyy')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Icons.clock className="w-5 h-5 text-[#98c6d5]" />
          <span>{format(new Date(booking.date), 'h:mm a')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Icons.user className="w-5 h-5 text-[#98c6d5]" />
          <span>{booking.customer.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Icons.location className="w-5 h-5 text-[#98c6d5]" />
          <span>{booking.customer.location || 'No location specified'}</span>
        </div>
      </div>
    </div>
    
    {booking.employeeMessage && (
      <div className="border-t border-gray-100 pt-4">
        <p className="text-gray-600 text-sm">
          <strong className="text-[#38bdf8]">Clinimedia:</strong> {booking.employeeMessage}
        </p>
      </div>
    )}
    
    {showAcceptButton && onAccept && (
      <div className="border-t border-gray-100 pt-4">
        <button 
          onClick={() => onAccept(booking._id)}
          disabled={isAccepting}
          className="bg-[#98c6d5] hover:bg-[#7bb3c4] disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {isAccepting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Accepting...
            </>
          ) : (
            <>
              <Icons.check className="w-4 h-4" />
              Accept Session
            </>
          )}
        </button>
      </div>
    )}
  </div>
);

// Empty state component
const EmptyState: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div className="text-center py-12">
    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <Icons.empty className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-500">{message}</p>
  </div>
);

// Tab button component
const TabButton: React.FC<{
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeColor: string;
}> = ({ isActive, onClick, children, activeColor }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? `${activeColor} text-white shadow-sm`
        : 'text-gray-600 hover:text-gray-800'
    }`}
  >
    {children}
  </button>
);

export const EmployeeMediaDayBookingPage: React.FC = () => {
  // State for tab switching
  const [activeTab, setActiveTab] = useState<'accepted' | 'available'>('available');

  // Get data from backend
  const {
    acceptedBookings,
    availableBookings,
    isLoading,
    error,
    calendarEvents,
    clearError,
    acceptSession,
    isAcceptingSession,
  } = useEmployeeMediaDayBooking();

  // Handle accept session
  const handleAcceptSession = async (bookingId: string) => {
    try {
      await acceptSession(bookingId);
    } catch (err) {
      // Error is already handled in the logic
    }
  };

  // Event styling
  const eventStyleGetter = useMemo(() => (event: MediaDayEvent) => {
    const backgroundColor = EVENT_COLORS[event.status] || EVENT_COLORS.pending;
    
    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.95,
        color: 'white',
        border: '0px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 4px',
        fontSize: '14px',
        fontWeight: '600',
        minHeight: '16px',
        minWidth: '16px',
        textAlign: 'center' as const,
      }
    };
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#98c6d5]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f9fafb] via-[#f3f4f6] to-[#e5e7eb] py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12 relative flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-2 bg-gradient-to-r from-gray-500 via-gray-700 to-black bg-clip-text text-transparent drop-shadow font-sans tracking-tight flex items-center justify-center gap-2">
            <span>Book your Photography Sessions!</span>
          </h1>
          <p className="text-base md:text-lg font-normal text-gray-800 max-w-xl mx-auto px-6 py-4 mt-2 rounded-2xl shadow-xl backdrop-blur-md bg-white/60 border border-transparent">
            Select the Media Days that fit your schedule and be part of telling each clinic’s unique story. Choose your session with ease and we’ll handle the rest so you can focus on what you do best.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <div className="flex justify-between items-center">
              <span>{error}</span>
              <button 
                onClick={clearError}
                className="text-red-700 hover:text-red-900"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Calendar Card */}
        <div className="bg-white rounded-2xl shadow-xl p-3 mb-12 transform transition-all duration-300 hover:shadow-2xl relative border-8 border-[#e5e7eb]">
          {/* Booking Legend (top right corner) */}
          <div className="absolute top-6 right-8 flex flex-wrap gap-4 items-center justify-end z-10">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#60a5fa]"></div>
              <span className="text-sm text-gray-700">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500"></div>
              <span className="text-sm text-gray-700">Accepted</span>
            </div>
          </div>
          <div className="[&_.rbc-calendar]:bg-white [&_.rbc-calendar]:rounded-lg [&_.rbc-calendar]:p-4 [&_.rbc-calendar]:shadow-sm [&_.rbc-header]:bg-[#98c6d5] [&_.rbc-header]:text-white [&_.rbc-header]:font-semibold [&_.rbc-header]:py-3 [&_.rbc-today]:bg-gray-50 [&_.rbc-off-range-bg]:bg-gray-50 [&_.rbc-button-link]:text-[#303b45] [&_.rbc-button-link]:transition-colors [&_.rbc-day-bg]:transition-colors [&_.rbc-day-bg:hover]:bg-[#98c6d5] [&_.rbc-day-bg:hover]:bg-opacity-20 [&_.rbc-day-bg.rbc-off-range]:opacity-50 [&_.rbc-day-bg.rbc-off-range]:cursor-not-allowed [&_.rbc-day-bg.rbc-off-range]:hover:bg-transparent">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              eventPropGetter={eventStyleGetter}
              views={['month', 'week', 'day']}
              defaultView="month"
              defaultDate={new Date()}
              tooltipAccessor={(event) => event.title}
              selectable
              popup
              components={{ toolbar: CustomToolbar }}
              formats={{
                dayHeaderFormat: (date: Date) => format(date, 'EEE')
              }}
              className="rounded-lg"
            />
          </div>
        </div>

        {/* My Photography Sessions */}
        <div className="bg-white border-8 rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold mb-8 bg-gradient-to-r from-gray-500 via-gray-700 to-black bg-clip-text text-transparent drop-shadow tracking-wide font-sans text-left">
            My Photography Sessions
          </h2>
          <div className="flex bg-gray-100 rounded-lg p-1 mb-6 w-fit">
            <TabButton
              isActive={activeTab === 'available'}
              onClick={() => setActiveTab('available')}
              activeColor="bg-[#60a5fa]"
            >
              Available Sessions
            </TabButton>
            <TabButton
              isActive={activeTab === 'accepted'}
              onClick={() => setActiveTab('accepted')}
              activeColor="bg-green-500"
            >
              Accepted Sessions
            </TabButton>
          </div>
          <div className="space-y-6">
            {activeTab === 'accepted' ? (
              // Accepted Sessions
              acceptedBookings.length > 0 ? (
                acceptedBookings.map((booking) => (
                  <BookingCard key={booking._id} booking={booking} />
                ))
              ) : (
                <EmptyState
                  title="No Accepted Sessions"
                  message="You don't have any confirmed photography sessions yet."
                />
              )
            ) : (
              // Available Sessions
              availableBookings.length > 0 ? (
                availableBookings.map((booking) => (
                  <BookingCard
                    key={booking._id}
                    booking={booking}
                    showAcceptButton
                    onAccept={handleAcceptSession}
                    isAccepting={isAcceptingSession}
                  />
                ))
              ) : (
                <EmptyState
                  title="No Available Sessions"
                  message="There are no photography sessions available at the moment."
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
