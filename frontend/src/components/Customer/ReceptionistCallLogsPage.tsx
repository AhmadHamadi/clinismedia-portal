import React, { useState, useEffect } from 'react';
import { FaPhone, FaClock, FaCalendar, FaCheckCircle, FaTimesCircle, FaSpinner, FaInfoCircle, FaFilter } from 'react-icons/fa';
import axios from 'axios';
import { startOfMonth, endOfMonth, subMonths, format, startOfDay, endOfDay, subDays } from 'date-fns';
import DatePicker from 'react-multi-date-picker';
import { formatPhoneDisplay } from '../../utils/formatPhone';

interface CallLogRow {
  id: string;
  callSid: string;
  from: string;
  fromDisplay?: string;
  to: string;
  status: string;
  duration: number;
  startedAt: string;
  dialCallStatus: string | null;
}

interface CallStats {
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
}

interface TwilioConfig {
  twilioPhoneNumber: string | null;
  isConnected: boolean;
}

/**
 * Receptionist Call Logs: same list and date filters as customer Call Logs,
 * but only Date & Time, Phone Number, Status, Duration. No summary, recording,
 * booked appointment, or new/existing patient.
 */
const ReceptionistCallLogsPage: React.FC = () => {
  const [callLogs, setCallLogs] = useState<CallLogRow[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [config, setConfig] = useState<TwilioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchCallLogs();
    fetchStats();
    fetchConfig();
  }, [startDate, endDate]);

  const fetchCallLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('customerToken');
      const params: Record<string, string | number> = { limit: 100, offset: 0 };
      if (startDate) params.startDate = format(startOfDay(startDate), 'yyyy-MM-dd');
      if (endDate) params.endDate = format(endOfDay(endDate), 'yyyy-MM-dd');

      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/twilio/call-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setCallLogs(response.data.callLogs || []);
    } catch (err: any) {
      console.error('Error fetching call logs:', err);
      setError(err.response?.data?.error || 'Failed to fetch call logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const params: Record<string, string> = {};
      if (startDate) params.startDate = format(startOfDay(startDate), 'yyyy-MM-dd');
      if (endDate) params.endDate = format(endOfDay(endDate), 'yyyy-MM-dd');

      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/twilio/call-logs/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setStats({
        totalCalls: response.data.totalCalls ?? 0,
        completedCalls: response.data.completedCalls ?? 0,
        missedCalls: response.data.missedCalls ?? 0,
      });
    } catch (err: any) {
      console.error('Error fetching call stats:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/twilio/configuration`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfig({
        twilioPhoneNumber: response.data.twilioPhoneNumber ?? null,
        isConnected: !!response.data.isConnected,
      });
    } catch (err: any) {
      console.error('Error fetching Twilio configuration:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const getStatusLabel = (dialCallStatus: string | null, status: string) => {
    if (dialCallStatus === 'answered') return 'Answered';
    if (dialCallStatus) return 'Missed';
    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)) return 'Missed';
    if (status === 'ringing' || status === 'in-progress') return status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
    return status;
  };

  const getStatusIcon = (dialCallStatus: string | null, status: string) => {
    if (dialCallStatus === 'answered') return <FaCheckCircle className="text-green-500" />;
    if (dialCallStatus && dialCallStatus !== 'answered') return <FaTimesCircle className="text-red-500" />;
    if (status === 'completed') return <FaCheckCircle className="text-green-500" />;
    if (['failed', 'busy', 'no-answer', 'canceled'].includes(status)) return <FaTimesCircle className="text-red-500" />;
    return <FaClock className="text-yellow-500" />;
  };

  const handlePast7Days = () => {
    const today = new Date();
    setStartDate(startOfDay(subDays(today, 6)));
    setEndDate(endOfDay(today));
    setActiveFilter('past7days');
  };

  const handleThisMonth = () => {
    const today = new Date();
    setStartDate(startOfMonth(today));
    setEndDate(endOfMonth(today));
    setActiveFilter('month');
  };

  const handleLastMonth = () => {
    const today = new Date();
    const lastMonth = subMonths(today, 1);
    setStartDate(startOfMonth(lastMonth));
    setEndDate(endOfMonth(lastMonth));
    setActiveFilter('month');
  };

  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setTempStartDate(null);
    setTempEndDate(null);
    setActiveFilter('all');
  };

  const handleCustomDateRangeChange = (dates: any) => {
    if (!dates) {
      setTempStartDate(null);
      setTempEndDate(null);
      return;
    }
    const dateArray = Array.isArray(dates) ? dates : [dates];
    const validDates = dateArray
      .filter((d: any) => d != null)
      .map((d: any) => (d && typeof d.toDate === 'function' ? d.toDate() : d instanceof Date ? d : new Date(d.year, (d.month ?? 1) - 1, d.day)))
      .filter((d: Date) => !isNaN(d.getTime()));
    if (validDates.length >= 2) {
      const sorted = validDates.sort((a: Date, b: Date) => a.getTime() - b.getTime());
      setTempStartDate(sorted[0]);
      setTempEndDate(sorted[1]);
    } else if (validDates.length === 1) {
      setTempStartDate(validDates[0]);
      setTempEndDate(null);
    } else {
      setTempStartDate(null);
      setTempEndDate(null);
    }
  };

  const handleApplyCustomRange = () => {
    if (tempStartDate && tempEndDate) {
      setStartDate(startOfDay(tempStartDate));
      setEndDate(endOfDay(tempEndDate));
      setActiveFilter('custom');
    } else if (tempStartDate) {
      setStartDate(startOfDay(tempStartDate));
      setEndDate(endOfDay(tempStartDate));
      setActiveFilter('custom');
    }
  };

  const getFilterDisplayText = () => {
    if (activeFilter === 'all') return 'All Calls';
    if (activeFilter === 'past7days' && startDate && endDate) return `Past 7 Days (${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')})`;
    if (activeFilter === 'month' && startDate && endDate) return format(startDate, 'MMMM yyyy');
    if (activeFilter === 'custom' && startDate && endDate) {
      if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) return format(startDate, 'MMMM d, yyyy');
      return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    }
    return 'All Calls';
  };

  if (loading && !callLogs.length) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen">
        <FaSpinner className="animate-spin text-3xl text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen overflow-x-hidden">
      <div className="w-full mx-auto max-w-full xl:max-w-7xl 2xl:max-w-7xl">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaPhone className="text-blue-500" />
            Call Logs
          </h1>
          <p className="text-sm text-gray-600 mt-1">Date, time, and phone number for all incoming calls</p>
        </div>

        {config && config.isConnected && (
          <div className="bg-white rounded-lg shadow mb-4 p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-2">
              <FaInfoCircle className="text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Tracking number:</span>
              <span className="text-sm font-mono text-gray-900">{config.twilioPhoneNumber}</span>
            </div>
          </div>
        )}

        {config && !config.isConnected && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4 text-sm">
            <p className="flex items-center gap-2">
              <FaInfoCircle />
              Call tracking is not connected. Contact your administrator.
            </p>
          </div>
        )}

        {/* Date Filters */}
        <div className="bg-white rounded-lg shadow mb-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <FaFilter className="text-blue-500" />
              Filter by date
            </h3>
            {(startDate || endDate) && (
              <button onClick={handleClearFilter} className="text-xs text-gray-600 hover:text-gray-800 underline">
                Clear filter
              </button>
            )}
          </div>
          {(startDate || endDate) && (
            <div className="mb-3 p-2 bg-blue-50 rounded text-sm border border-blue-200">
              <span className="font-medium text-gray-800">Active: </span>
              <span className="text-blue-700 font-semibold">{getFilterDisplayText()}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePast7Days}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${activeFilter === 'past7days' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Past 7 days
            </button>
            <button
              onClick={handleThisMonth}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${activeFilter === 'month' && startDate && format(startDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              This month
            </button>
            <button
              onClick={handleLastMonth}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${activeFilter === 'month' && startDate && format(startDate, 'yyyy-MM') === format(subMonths(new Date(), 1), 'yyyy-MM') ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Last month
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <FaCalendar className="text-gray-600 text-sm" />
              <span className="text-sm text-gray-800 font-medium whitespace-nowrap">Custom range:</span>
              <div className="min-w-[280px]">
                <DatePicker
                  value={tempStartDate && tempEndDate ? [tempStartDate, tempEndDate] : tempStartDate ? [tempStartDate] : startDate && endDate ? [startDate, endDate] : undefined}
                  onChange={handleCustomDateRangeChange}
                  range
                  rangeHover
                  numberOfMonths={2}
                  format="MMM D, YYYY"
                  className="rmdp-wrapper w-full"
                  inputClass="!bg-white !border !border-gray-300 !rounded !px-3 !py-1.5 !text-sm !text-gray-900 !w-full"
                  placeholder="Start date → End date"
                  maxDate={new Date()}
                />
              </div>
              <button
                onClick={handleApplyCustomRange}
                disabled={!tempStartDate || !tempEndDate}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium ${tempStartDate && tempEndDate ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
        )}

        {/* Stats: Total, Answered, Missed only */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white p-3 rounded-lg shadow">
              <p className="text-xs text-gray-600">Total calls</p>
              <p className="text-xl font-bold text-gray-800">{stats.totalCalls}</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow">
              <p className="text-xs text-gray-600">Answered</p>
              <p className="text-xl font-bold text-green-600">{stats.completedCalls}</p>
            </div>
            <div className="bg-white p-3 rounded-lg shadow">
              <p className="text-xs text-gray-600">Missed</p>
              <p className="text-xl font-bold text-red-600">{stats.missedCalls}</p>
            </div>
          </div>
        )}

        {/* Table: Date & Time, Phone number, Status, Duration only */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Recent calls</h2>
            {stats && <p className="text-xs text-gray-600 mt-1">Showing {callLogs.length} of {stats.totalCalls} calls</p>}
          </div>

          {callLogs.length === 0 ? (
            <div className="p-8 text-center">
              <FaPhone className="text-3xl text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">No call logs in this date range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date & time</th>
                    <th className="px-4 py-3 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Phone number</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {callLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-base font-medium text-gray-900">{formatDate(log.startedAt)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap bg-blue-50/50">
                        <span className="text-xl font-bold font-mono text-gray-900 tracking-wide" style={{ letterSpacing: '0.05em' }}>{log.fromDisplay ?? formatPhoneDisplay(log.from)}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.dialCallStatus, log.status)}
                          <span className="text-sm font-medium text-gray-800">{getStatusLabel(log.dialCallStatus, log.status)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-sm text-gray-700">{formatDuration(log.duration)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceptionistCallLogsPage;
