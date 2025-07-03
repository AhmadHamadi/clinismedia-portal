import React, { useState, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Event } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAdminMediaDayBooking } from './AdminMediaDayBookingLogic';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import DatePicker from 'react-multi-date-picker';
import Select from 'react-select';
import type { DateObject } from 'react-multi-date-picker';
import type { MultiValue } from 'react-select';
import Modal from 'react-modal';

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

// Event colors mapping
const EVENT_COLORS = {
  pending: '#fbbf24', // Yellow
  accepted: '#22c55e', // Green
  declined: '#f87171', // Red
  blocked: '#303b45', // Dark grey
} as const;

// Modal styles
const customModalStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    width: '50%',
    padding: '2rem',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
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

const AdminMediaDayBookingPage: React.FC = () => {
  const {
    bookings,
    calendarEvents,
    isLoading,
    error,
    isDenyModalOpen,
    isAcceptModalOpen,
    selectedBooking,
    setSelectedBooking,
    adminMessage,
    setAdminMessage,
    handleAcceptRequest,
    handleDenyRequest,
    openDenyModal,
    openAcceptModal,
    setIsDenyModalOpen,
    setIsAcceptModalOpen,
    showPriorRequests,
    setShowPriorRequests,
    blockedDatesEvents,
    addBlockedDates,
    customers,
    isCreatingBooking,
    createBookingForCustomer,
    isUnblockModalOpen,
    setIsUnblockModalOpen,
    selectedBlockedDates,
    setSelectedBlockedDates,
    isUnblocking,
    unblockDates,
    selectedDateForBooking,
    setSelectedDateForBooking,
    selectedCustomerForBooking,
    setSelectedCustomerForBooking,
    selectedTimeForBooking,
    setSelectedTimeForBooking,
    timeSlots,
    allTimeSlots,
    bookingView,
    setBookingView,
    employees,
    isEditPhotographyModalOpen,
    setIsEditPhotographyModalOpen,
    selectedBookingForEdit,
    setSelectedBookingForEdit,
    selectedPhotographerId,
    setSelectedPhotographerId,
    editEmployeeMessage,
    setEditEmployeeMessage,
    isUpdatingPhotography,
    updatePhotographyAssignment,
    openEditPhotographyModal,
  } = useAdminMediaDayBooking();

  // Local state
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockedDates, setBlockedDates] = useState<DateObject[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<MultiValue<any>>([]);
  const [blockAllCustomers, setBlockAllCustomers] = useState(false);
  const [isCreateBookingModalOpen, setIsCreateBookingModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [employeeMessage, setEmployeeMessage] = useState('');

  // Computed values
  const customerOptions = useMemo(() => 
    customers.map(customer => ({
      value: customer._id,
      label: customer.name
    })), [customers]
  );

  const combinedEvents = useMemo(() => [
    ...calendarEvents.map(event => ({
      ...event,
      title: event.title.split(' - ')[0], // Remove status, keep only customer name
    })),
    ...blockedDatesEvents.map(block => ({
      id: `blocked-${block.id}`,
      title: 'Date Blocked',
      start: new Date(block.date),
      end: new Date(new Date(block.date).getTime() + 60 * 60 * 1000),
      status: 'blocked',
      isBlocked: true,
    })),
  ], [calendarEvents, blockedDatesEvents]);

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

  const isDateAvailableForBooking = (date: Date, blockedDatesEvents: any[], bookings: any[]): boolean => {
    const isBlocked = blockedDatesEvents.some(block => {
      const blockDate = new Date(block.date);
      return blockDate.getFullYear() === date.getFullYear() &&
        blockDate.getMonth() === date.getMonth() &&
        blockDate.getDate() === date.getDate();
    });

    const hasAcceptedBooking = bookings.some(booking => {
      if (booking.status !== 'accepted') return false;
      const bookingDate = new Date(booking.date);
      return bookingDate.getFullYear() === date.getFullYear() &&
        bookingDate.getMonth() === date.getMonth() &&
        bookingDate.getDate() === date.getDate();
    });

    return !isBlocked && !hasAcceptedBooking;
  };

  // Event handlers
  const handleCalendarSelect = ({ start }: { start: Date }): void => {
    if (isDateAvailableForBooking(start, blockedDatesEvents, bookings)) {
      setSelectedDateForBooking(start);
      setIsCreateBookingModalOpen(true);
    }
  };

  const handleConfirmBlock = (): void => {
    if (blockedDates.length > 0) {
      addBlockedDates(blockedDates);
      setBlockedDates([]);
      setIsBlockModalOpen(false);
    }
  };

  const handleConfirmUnblock = (): void => {
    if (selectedBlockedDates.length > 0) {
      unblockDates(selectedBlockedDates);
    }
  };

  const handleBlockedDateToggle = (dateId: string): void => {
    setSelectedBlockedDates(prev => 
      prev.includes(dateId) 
        ? prev.filter(id => id !== dateId)
        : [...prev, dateId]
    );
  };

  const handleSelectAllBlockedDates = (): void => {
    if (selectedBlockedDates.length === blockedDatesEvents.length) {
      setSelectedBlockedDates([]);
    } else {
      setSelectedBlockedDates(blockedDatesEvents.map(block => block.id));
    }
  };

  const handleCreateBooking = async (): Promise<void> => {
    try {
      if (selectedCustomerForBooking && selectedDateForBooking && selectedTimeForBooking) {
        await createBookingForCustomer(
          selectedCustomerForBooking.value,
          selectedDateForBooking,
          selectedTimeForBooking,
          bookingNotes
        );
        setIsConfirmModalOpen(false);
        setSelectedCustomerForBooking(null);
        setSelectedDateForBooking(null);
        setSelectedTimeForBooking(null);
        setBookingNotes('');
        setSuccessMessage('Booking created successfully!');
        setBookingError(null);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error: any) {
      setBookingError(`Failed to create booking: ${error.response?.data?.message || error.message}`);
      setSuccessMessage(null);
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#303b45] mb-4">
            Media Day Management
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            View and manage media day requests. Accept or decline requests and keep track of scheduled sessions.
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-8 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
            {successMessage}
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        {bookingError && (
          <div className="mb-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {bookingError}
          </div>
        )}

        {/* Block Dates Modal */}
        {isBlockModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-lg w-full">
              <h2 className="text-2xl font-bold text-[#303b45] mb-6">Block Dates</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Date(s) to Block</label>
                <DatePicker
                  multiple
                  value={blockedDates}
                  onChange={dates => setBlockedDates(Array.isArray(dates) ? dates : [])}
                  format="YYYY-MM-DD"
                  className="w-full"
                  calendarPosition="bottom-center"
                  sort={false}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="mb-8 min-h-[28px] flex flex-wrap gap-2">
                {blockedDates && blockedDates.length > 0 ? (
                  blockedDates.map(date => (
                    <span key={date.format('YYYY-MM-DD')} className="px-3 py-1 rounded-full bg-gray-200 text-[#303b45] text-sm font-medium border border-gray-300">
                      {date.format('YYYY-MM-DD')}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 text-sm">No dates selected</span>
                )}
              </div>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setIsBlockModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBlock}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                >
                  Confirm Block
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unblock Dates Modal */}
        {isUnblockModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto">
              <h2 className="text-2xl font-bold text-[#303b45] mb-6">Unblock Dates</h2>
              
              {blockedDatesEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 mb-4">No blocked dates to unblock</p>
                  <button
                    onClick={() => setIsUnblockModalOpen(false)}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBlockedDates.length === blockedDatesEvents.length}
                        onChange={handleSelectAllBlockedDates}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Select All ({blockedDatesEvents.length} dates)
                      </span>
                    </label>
                  </div>
                  
                  <div className="mb-6 space-y-2 max-h-64 overflow-y-auto">
                    {blockedDatesEvents.map((block) => (
                      <label key={block.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBlockedDates.includes(block.id)}
                          onChange={() => handleBlockedDateToggle(block.id)}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(block.date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                          {block.booking && (
                            <div className="text-xs text-gray-500 mt-1">
                              Booked by: {block.booking.customer.name} ({block.booking.status})
                            </div>
                          )}
                          {block.isManualBlock && !block.booking && (
                            <div className="text-xs text-gray-500 mt-1">
                              Manually blocked
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">
                      {selectedBlockedDates.length} of {blockedDatesEvents.length} dates selected
                    </span>
                    <div className="flex gap-4">
                      <button
                        onClick={() => {
                          setIsUnblockModalOpen(false);
                          setSelectedBlockedDates([]);
                        }}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmUnblock}
                        disabled={selectedBlockedDates.length === 0 || isUnblocking}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          selectedBlockedDates.length > 0 && !isUnblocking
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-red-200 text-red-400 cursor-not-allowed'
                        }`}
                      >
                        {isUnblocking ? 'Unblocking...' : `Unblock ${selectedBlockedDates.length} Date${selectedBlockedDates.length !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Calendar Section */}
        <div className="bg-white rounded-xl shadow-xl p-8 mb-8 transform transition-all duration-300 hover:shadow-2xl">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold text-[#303b45] mb-2">Scheduled Media Days</h2>
              <p className="text-gray-600">View all scheduled and pending media day requests</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsBlockModalOpen(true)}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-semibold shadow"
              >
                Block Dates
              </button>
              {blockedDatesEvents.length > 0 && (
                <button
                  onClick={() => setIsUnblockModalOpen(true)}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold shadow"
                >
                  Unblock Dates
                </button>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="mb-4 flex flex-wrap gap-4 items-center">
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

          <div className="[&_.rbc-calendar]:bg-white [&_.rbc-calendar]:rounded-lg [&_.rbc-calendar]:p-4 [&_.rbc-calendar]:shadow-sm [&_.rbc-header]:bg-[#98c6d5] [&_.rbc-header]:text-white [&_.rbc-header]:font-semibold [&_.rbc-header]:py-3 [&_.rbc-today]:bg-gray-50 [&_.rbc-off-range-bg]:bg-gray-50 [&_.rbc-button-link]:text-[#303b45] [&_.rbc-button-link]:transition-colors [&_.rbc-day-slot]:cursor-pointer [&_.rbc-day-slot:hover]:bg-blue-50 [&_.rbc-day-slot.rbc-off-range]:cursor-default [&_.rbc-day-slot.rbc-off-range:hover]:bg-transparent">
            <Calendar
              localizer={localizer}
              events={combinedEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              views={['month']}
              className="rounded-lg"
              selectable={true}
              components={{
                toolbar: CustomToolbar
              }}
              formats={{
                monthHeaderFormat: () => '' // Hide default month header
              }}
              eventPropGetter={eventStyleGetter}
              onSelectSlot={handleCalendarSelect}
            />
          </div>
        </div>

        {/* Requests Section */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-[#303b45]">
              Media Day Requests
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setBookingView('pending')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  bookingView === 'pending'
                    ? 'bg-[#fbbf24] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending Requests
              </button>
              <button
                onClick={() => setBookingView('accepted')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  bookingView === 'accepted'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Accepted Bookings
              </button>
              <button
                onClick={() => setBookingView('declined')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  bookingView === 'declined'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Declined Bookings
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#98c6d5] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <p className="text-gray-600 text-center py-4">
              {bookingView === 'pending' && 'No pending requests to display'}
              {bookingView === 'accepted' && 'No accepted bookings to display'}
              {bookingView === 'declined' && 'No declined bookings to display'}
            </p>
          ) : (
            <div className="space-y-6">
              {bookings.map((booking) => (
                <div key={booking._id} className="bg-gray-50 rounded-lg p-6 relative min-h-[180px] flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-[#303b45]">{booking.customer.name}</h3>
                      <p className="text-gray-600">{booking.customer.email}</p>
                    </div>
                    <div className="flex flex-col items-center gap-3 min-w-[7rem]">
                      {booking.status === 'pending' && (
                        <>
                          <button
                            onClick={() => openAcceptModal(booking)}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => openDenyModal(booking)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {booking.status === 'accepted' && (
                        <>
                          <button
                            onClick={() => openEditPhotographyModal(booking)}
                            className="w-36 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-medium h-10"
                          >
                            Edit Photography
                          </button>
                          <button
                            onClick={() => openDenyModal(booking)}
                            className="w-36 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium h-10"
                          >
                            Overturn
                          </button>
                        </>
                      )}
                      {booking.status === 'declined' && (
                        <button
                          onClick={() => (setSelectedBooking(booking), setIsAcceptModalOpen(true))}
                          className="w-36 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium h-10"
                        >
                          Overturn
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-gray-600">
                      <span className="font-semibold">Date & Time:</span>{' '}
                      {formatDateTime(booking.date)}
                    </p>
                    {booking.status === 'accepted' && (
                      <p className="text-gray-600">
                        <span className="font-semibold">Photographer:</span>{' '}
                        {booking.photographer ? booking.photographer.name : 'Not Assigned'}
                      </p>
                    )}
                    {booking.notes && (
                      <p className="text-gray-600">
                        <span className="font-semibold">Notes:</span> {booking.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deny Modal */}
        {isDenyModalOpen && selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <h3 className="text-xl font-semibold text-[#303b45] mb-4">
                {selectedBooking.status === 'accepted' ? 'Overturn Accepted Request' : 'Decline Request'}
              </h3>
              <p className="text-gray-600 mb-4">
                {selectedBooking.status === 'accepted' 
                  ? 'Are you sure you want to overturn this accepted request? Please provide a reason:'
                  : 'Are you sure you want to decline this request? Please provide a reason:'
                }
              </p>
              <textarea
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                className="w-full p-2 border rounded-lg mb-4 text-gray-900 bg-white"
                rows={3}
                placeholder="Enter reason for overturning/declining..."
              />
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setIsDenyModalOpen(false);
                    setAdminMessage('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDenyRequest(selectedBooking._id)}
                  disabled={!adminMessage.trim()}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    adminMessage.trim()
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-red-200 text-red-400 cursor-not-allowed'
                  }`}
                >
                  {selectedBooking.status === 'accepted' ? 'Decline Request' : 'Confirm Decline'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Accept Modal */}
        {isAcceptModalOpen && selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-[#303b45] mb-4">
                {selectedBooking.status === 'declined' ? 'Revert Declined Request' : 'Accept Request'}
              </h3>
              <p className="text-gray-600 mb-4">
                {selectedBooking.status === 'declined'
                  ? `Are you sure you want to revert this declined request and accept the booking for ${selectedBooking.customer.name}?`
                  : `Are you sure you want to accept this request for ${selectedBooking.customer.name}?`}
              </p>
              <div className="text-gray-600 mb-6">
                <p><span className="font-semibold">Date & Time:</span> {formatDateTime(selectedBooking.date)}</p>
                {selectedBooking.notes && (
                  <p><span className="font-semibold">Customer Notes:</span> {selectedBooking.notes}</p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Message for Customer
                  </label>
                  <textarea
                    value={adminMessage}
                    onChange={(e) => setAdminMessage(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    rows={4}
                    placeholder="Enter a message for the customer..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This message will be visible to the customer in their booking section.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Message for Employee
                  </label>
                  <textarea
                    value={employeeMessage}
                    onChange={(e) => setEmployeeMessage(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    rows={4}
                    placeholder="Enter a message that will be displayed to the employee..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This message will be visible to the employee in their photography session.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setIsAcceptModalOpen(false);
                    setSelectedBooking(null);
                    setAdminMessage('');
                    setEmployeeMessage('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAcceptRequest(selectedBooking._id, adminMessage, employeeMessage)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  {selectedBooking.status === 'declined' ? 'Accept Request' : 'Confirm Acceptance'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Photography Modal */}
        {isEditPhotographyModalOpen && selectedBookingForEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-[#303b45] mb-4">
                Edit Photography Assignment
              </h3>
              <p className="text-gray-600 mb-4">
                Update photographer assignment and message for {selectedBookingForEdit.customer.name}
              </p>
              <div className="text-gray-600 mb-6">
                <p><span className="font-semibold">Date & Time:</span> {formatDateTime(selectedBookingForEdit.date)}</p>
                {selectedBookingForEdit.notes && (
                  <p><span className="font-semibold">Customer Notes:</span> {selectedBookingForEdit.notes}</p>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Assign Photographer
                  </label>
                  <select
                    value={selectedPhotographerId || ''}
                    onChange={(e) => setSelectedPhotographerId(e.target.value || null)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="">No Photographer Assigned</option>
                    {employees.map((employee) => (
                      <option key={employee._id} value={employee._id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select a photographer to assign to this booking
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Message for Employee
                  </label>
                  <textarea
                    value={editEmployeeMessage}
                    onChange={(e) => setEditEmployeeMessage(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                    rows={4}
                    placeholder="Enter a message for the employee..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This message will be visible to the employee in their photography session.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setIsEditPhotographyModalOpen(false);
                    setSelectedBookingForEdit(null);
                    setSelectedPhotographerId(null);
                    setEditEmployeeMessage('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updatePhotographyAssignment(selectedBookingForEdit._id)}
                  disabled={isUpdatingPhotography}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {isUpdatingPhotography ? 'Updating...' : 'Update Assignment'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customer Selection Modal for Admin Booking Creation */}
        <Modal
          isOpen={isCreateBookingModalOpen}
          onRequestClose={() => setIsCreateBookingModalOpen(false)}
          style={customModalStyles}
          contentLabel="Create Booking for Customer"
        >
          <div className="p-6 bg-white">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Create Booking for Customer</h2>
            <p className="text-gray-700 mb-4">
              Select a customer to create a booking for{' '}
              <strong className="text-gray-900">{selectedDateForBooking?.toLocaleDateString()}</strong>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Select Customer
              </label>
              <Select
                value={selectedCustomerForBooking}
                onChange={setSelectedCustomerForBooking}
                options={customerOptions}
                placeholder="Choose a customer..."
                className="text-gray-900"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Select Time
              </label>
              <div className="grid grid-cols-3 gap-4">
                {allTimeSlots.map((slot) => {
                  const isAvailable = timeSlots.some(ts => ts.time === slot.time);
                  return (
                    <button
                      key={slot.id}
                      onClick={() => isAvailable && setSelectedTimeForBooking(slot.time)}
                      disabled={!isAvailable}
                      className={`p-3 rounded-lg text-center transition-all duration-200 transform ${
                        selectedTimeForBooking === slot.time && isAvailable
                          ? 'bg-[#98c6d5] text-white shadow-lg'
                          : isAvailable
                            ? 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {slot.time}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Add any notes for this booking..."
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsCreateBookingModalOpen(false);
                  setSelectedCustomerForBooking(null);
                  setBookingNotes('');
                  setSelectedTimeForBooking(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedCustomerForBooking && selectedTimeForBooking) {
                    setIsCreateBookingModalOpen(false);
                    setIsConfirmModalOpen(true);
                  }
                }}
                disabled={!selectedCustomerForBooking || !selectedTimeForBooking}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </Modal>

        {/* Confirmation Modal */}
        <Modal
          isOpen={isConfirmModalOpen}
          onRequestClose={() => setIsConfirmModalOpen(false)}
          style={customModalStyles}
          contentLabel="Confirm Booking Creation"
        >
          <div className="p-6 bg-white">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Confirm Booking Creation</h2>
            <p className="text-gray-700 mb-4">
              Are you sure you want to create a booking for <strong className="text-gray-900">{selectedCustomerForBooking?.label}</strong> on{' '}
              <strong className="text-gray-900">{selectedDateForBooking?.toLocaleDateString()}</strong> at <strong className="text-gray-900">{selectedTimeForBooking}</strong>?
            </p>
            {bookingNotes && (
              <p className="text-gray-700 mb-2">
                <strong className="text-gray-900">Notes:</strong> {bookingNotes}
              </p>
            )}
            <p className="text-sm text-gray-600 mb-6">
              This will immediately create an accepted booking for the customer.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBooking}
                disabled={!selectedCustomerForBooking || !selectedDateForBooking || !selectedTimeForBooking}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default AdminMediaDayBookingPage;

