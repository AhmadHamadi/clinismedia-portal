import React from 'react';
import { Calendar, dateFnsLocalizer, Event } from 'react-big-calendar';
import { format } from 'date-fns';
import { parse } from 'date-fns';
import { startOfWeek } from 'date-fns';
import { getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAdminMediaDayBooking } from './AdminMediaDayBookingLogic';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

// Custom toolbar component for the calendar
const CustomToolbar = (toolbar: any) => {
  const goToPreviousMonth = () => {
    toolbar.onNavigate('PREV');
  };

  const goToNextMonth = () => {
    toolbar.onNavigate('NEXT');
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronLeftIcon className="w-6 h-6 text-[#303b45]" />
        </button>
        <button
          onClick={goToNextMonth}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ChevronRightIcon className="w-6 h-6 text-[#303b45]" />
        </button>
      </div>
      <h2 className="text-2xl font-semibold text-[#303b45]">
        {format(toolbar.date, 'MMMM yyyy')}
      </h2>
      <div className="w-24" /> {/* Spacer for balance */}
    </div>
  );
};

interface MediaDayEvent extends Event {
  status: 'pending' | 'accepted' | 'denied';
}

const AdminMediaDayBookingPage: React.FC = () => {
  const {
    requests,
    calendarEvents,
    isDenyModalOpen,
    isAcceptModalOpen,
    selectedRequest,
    setSelectedRequest,
    denialReason,
    setDenialReason,
    handleAcceptRequest,
    handleDenyRequest,
    openDenyModal,
    openAcceptModal,
    setIsDenyModalOpen,
    setIsAcceptModalOpen,
    showPriorRequests,
    setShowPriorRequests
  } = useAdminMediaDayBooking();

  // Custom event styling based on status
  const eventStyleGetter = (event: MediaDayEvent) => {
    let backgroundColor = '#98c6d5'; // Default color
    if (event.status === 'accepted') {
      backgroundColor = '#4ade80'; // Green for accepted
    } else if (event.status === 'denied') {
      backgroundColor = '#f87171'; // Red for denied
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
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
            View and manage media day requests. Accept or deny requests and keep track of scheduled sessions.
          </p>
        </div>

        {/* Calendar Section */}
        <div className="bg-white rounded-xl shadow-xl p-8 mb-8 transform transition-all duration-300 hover:shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-[#303b45] mb-2">Scheduled Media Days</h2>
            <p className="text-gray-600">View all scheduled and pending media day requests</p>
          </div>
          <div className="[&_.rbc-calendar]:bg-white [&_.rbc-calendar]:rounded-lg [&_.rbc-calendar]:p-4 [&_.rbc-calendar]:shadow-sm [&_.rbc-header]:bg-[#98c6d5] [&_.rbc-header]:text-white [&_.rbc-header]:font-semibold [&_.rbc-header]:py-3 [&_.rbc-today]:bg-gray-50 [&_.rbc-off-range-bg]:bg-gray-50 [&_.rbc-button-link]:text-[#303b45] [&_.rbc-button-link]:transition-colors">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              views={['month']}
              className="rounded-lg"
              components={{
                toolbar: CustomToolbar
              }}
              formats={{
                monthHeaderFormat: () => '' // Hide default month header
              }}
              eventPropGetter={eventStyleGetter}
            />
          </div>
        </div>

        {/* Requests Section */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-[#303b45]">
              {showPriorRequests ? 'Prior Media Day Requests' : 'Current Media Day Requests'}
            </h2>
            <button
              onClick={() => setShowPriorRequests(!showPriorRequests)}
              className="px-4 py-2 bg-[#98c6d5] text-white rounded-lg hover:bg-[#7ab4c3] transition-colors"
            >
              {showPriorRequests ? 'View Current Requests' : 'View Prior Requests'}
            </button>
          </div>
          <div className="space-y-6">
            {requests.length === 0 ? (
              <p className="text-gray-600 text-center py-4">
                {showPriorRequests 
                  ? 'No prior requests to display' 
                  : 'No current requests to display'}
              </p>
            ) : (
              requests.map((request) => (
                <div key={request.id} className="bg-gray-50 rounded-lg p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-[#303b45]">{request.customerName}</h3>
                      <p className="text-gray-600">{request.email}</p>
                      <p className="text-gray-600">{request.phone}</p>
                    </div>
                    <div className="flex gap-4">
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => openAcceptModal(request)}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => openDenyModal(request)}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                          >
                            Deny
                          </button>
                        </>
                      )}
                      {request.status === 'accepted' && (
                        <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                          Accepted
                        </span>
                      )}
                      {request.status === 'denied' && (
                        <span className="px-4 py-2 bg-red-100 text-red-800 rounded-lg">
                          Denied
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-gray-600">
                      <span className="font-semibold">Date:</span>{' '}
                      {new Date(request.date).toLocaleDateString()}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Time:</span> {request.time}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Location:</span> {request.location}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Notes:</span> {request.notes}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Deny Modal */}
        {isDenyModalOpen && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <h3 className="text-xl font-semibold text-[#303b45] mb-4">Deny Request</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to deny this request? Please provide a reason:
              </p>
              <textarea
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                className="w-full p-2 border rounded-lg mb-4"
                rows={3}
                placeholder="Enter reason for denial..."
              />
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setIsDenyModalOpen(false);
                    setDenialReason('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDenyRequest(selectedRequest.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Confirm Denial
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Accept Modal */}
        {isAcceptModalOpen && selectedRequest && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-xl p-8 max-w-md w-full">
              <h3 className="text-xl font-semibold text-[#303b45] mb-4">Accept Request</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to accept this request for {selectedRequest.customerName}?
              </p>
              <div className="text-gray-600 mb-4">
                <p><span className="font-semibold">Date:</span> {new Date(selectedRequest.date).toLocaleDateString()}</p>
                <p><span className="font-semibold">Time:</span> {selectedRequest.time}</p>
                <p><span className="font-semibold">Location:</span> {selectedRequest.location}</p>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => {
                    setIsAcceptModalOpen(false);
                    setSelectedRequest(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAcceptRequest(selectedRequest.id)}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  Confirm Acceptance
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMediaDayBookingPage;
