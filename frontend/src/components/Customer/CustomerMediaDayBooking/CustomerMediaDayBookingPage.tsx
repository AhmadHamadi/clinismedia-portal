import React from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format } from 'date-fns';
import { parse } from 'date-fns';
import { startOfWeek } from 'date-fns';
import { getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useMediaDayBooking } from './CustomerMediaDayBookingLogic';
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

const CustomerMediaDayBookingPage: React.FC = () => {
  const {
    selectedDate,
    selectedTime,
    isTimeModalOpen,
    timeSlots,
    notes,
    handleDateSelect,
    handleTimeSelect,
    handleSubmit,
    setIsTimeModalOpen,
    setNotes
  } = useMediaDayBooking();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#303b45] mb-4">
            Book Your Media Day
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Select your preferred date and time for your media day. We'll confirm your booking and send you all the details.
          </p>
        </div>
        
        {/* Calendar Container */}
        <div className="bg-white rounded-xl shadow-xl p-8 mb-8 transform transition-all duration-300 hover:shadow-2xl">
          <div className="mb-6">
          </div>
          <div className="[&_.rbc-calendar]:bg-white [&_.rbc-calendar]:rounded-lg [&_.rbc-calendar]:p-4 [&_.rbc-calendar]:shadow-sm [&_.rbc-header]:bg-[#98c6d5] [&_.rbc-header]:text-white [&_.rbc-header]:font-semibold [&_.rbc-header]:py-3 [&_.rbc-today]:bg-gray-50 [&_.rbc-off-range-bg]:bg-gray-50 [&_.rbc-button-link]:text-[#303b45] [&_.rbc-button-link]:transition-colors [&_.rbc-day-bg]:transition-colors [&_.rbc-day-bg:hover]:bg-[#98c6d5] [&_.rbc-day-bg:hover]:bg-opacity-20 [&_.rbc-day-bg.rbc-off-range]:opacity-50 [&_.rbc-day-bg.rbc-off-range]:cursor-not-allowed [&_.rbc-day-bg.rbc-off-range]:hover:bg-transparent">
            <Calendar
              localizer={localizer}
              events={[]}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              onSelectSlot={({ start }) => handleDateSelect(start)}
              selectable
              views={['month']}
              className="rounded-lg"
              components={{
                toolbar: CustomToolbar
              }}
              formats={{
                monthHeaderFormat: () => '' // Hide default month header
              }}
              dayPropGetter={(date) => {
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                return {
                  className: isPast ? 'rbc-off-range' : '',
                  onClick: isPast ? (e: React.MouseEvent) => e.preventDefault() : undefined
                };
              }}
            />
          </div>
        </div>

        {/* Time Selection Modal */}
        {isTimeModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-8 max-w-md w-full transform transition-all duration-300 scale-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-[#303b45]">
                  Select Time for {selectedDate?.toLocaleDateString('en-US', { 
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
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
                {timeSlots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => handleTimeSelect(slot.time)}
                    className={`p-4 rounded-lg text-center transition-all duration-200 transform hover:scale-105 ${
                      selectedTime === slot.time
                        ? 'bg-[#98c6d5] text-white shadow-lg'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>

              {/* Additional Notes Section */}
              <div className="mb-8">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#98c6d5] focus:border-[#98c6d5] transition-colors resize-none text-gray-900"
                  placeholder="Add any additional information or special requests..."
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setIsTimeModalOpen(false)}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedTime}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 ${
                    selectedTime
                      ? 'bg-[#98c6d5] text-white hover:bg-[#7ab4c3] shadow-lg'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Confirm Booking
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
