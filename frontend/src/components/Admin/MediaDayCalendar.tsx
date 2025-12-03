// src/components/Admin/MediaDayCalendar.tsx
import { FaCalendarAlt } from 'react-icons/fa';

const MediaDayCalendarPage = () => {
  return (
    <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
          <FaCalendarAlt className="mr-3 text-blue-600" />
          Media Day Calendar
        </h1>
        <p className="text-gray-600">
          View and manage media day events and bookings
        </p>
      </div>

      {/* Placeholder Card */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <FaCalendarAlt className="text-6xl text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Media Day Calendar</h3>
            <p className="text-gray-600">Media day calendar UI goes here.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaDayCalendarPage;
