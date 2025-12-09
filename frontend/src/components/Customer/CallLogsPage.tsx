import React, { useState, useEffect } from 'react';
import { FaPhone, FaClock, FaCalendar, FaUser, FaCheckCircle, FaTimesCircle, FaSpinner, FaChartBar, FaInfoCircle, FaHeadphones, FaMapMarkerAlt, FaDollarSign, FaFileAlt, FaEye, FaTimes, FaFilter, FaCalendarCheck, FaTrash } from 'react-icons/fa';
import axios from 'axios';
import { startOfMonth, endOfMonth, subMonths, format, startOfDay, endOfDay, subDays } from 'date-fns';
import DatePicker from 'react-multi-date-picker';

interface CallLog {
  id: string;
  callSid: string;
  from: string;
  to: string;
  status: string;
  duration: number;
  menuChoice: string | null;
  menuChoiceLabel: string | null;
  startedAt: string;
  endedAt: string | null;
  direction: string;
  // Recording
  recordingUrl: string | null;
  recordingSid: string | null;
  // Caller Information
  callerName: string | null;
  callerCity: string | null;
  callerState: string | null;
  callerZip: string | null;
  callerCountry: string | null;
  // Call Quality Metrics
  qualityMetrics: {
    jitter?: number;
    packetLoss?: number;
    latency?: number;
    audioQuality?: string;
  } | null;
  // Call Pricing
  price: number | null;
  priceUnit: string;
  // Call Events
  ringingDuration: number | null;
  answerTime: string | null;
  // Transcription (legacy)
  transcriptUrl: string | null;
  transcriptSid: string | null;
  transcriptText: string | null;
  // Conversational Intelligence Summary
  summaryText: string | null;
  summaryReady: boolean;
  appointmentBooked: boolean | null; // null = not analyzed, true = booked, false = not booked
  // Voicemail
  voicemailUrl: string | null;
  voicemailDuration: number | null;
  // Dial Call Status (whether clinic answered)
  dialCallStatus: string | null;
}

interface CallStats {
  totalCalls: number;
  completedCalls: number;
  missedCalls: number;
  newPatientCalls: number;
  existingPatientCalls: number;
  appointmentsBooked: number;
  totalDuration: number;
  avgDuration: number;
  totalDurationFormatted: string;
  avgDurationFormatted: string;
}

interface TwilioConfig {
  twilioPhoneNumber: string | null;
  twilioForwardNumber: string | null;
  twilioForwardNumberNew: string | null;
  twilioForwardNumberExisting: string | null;
  twilioMenuMessage: string;
  isConnected: boolean;
  menuEnabled: boolean;
  recordingEnabled: boolean;
  transcriptionEnabled: boolean;
}

const CallLogsPage: React.FC = () => {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [config, setConfig] = useState<TwilioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);
  const [showCallDetails, setShowCallDetails] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [loadingRecording, setLoadingRecording] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all'); // 'all', 'past7days', 'month', 'custom'
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [deletingLogs, setDeletingLogs] = useState(false);

  useEffect(() => {
    fetchCallLogs();
    fetchStats();
    fetchConfig();
    
    // Mark Call Logs as read when page opens
    const markCallLogsAsRead = async () => {
      try {
        const token = localStorage.getItem('customerToken');
        if (!token) return;
        
        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/customer-notifications/mark-read/callLogs`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        // Trigger notification refresh
        window.dispatchEvent(new Event('refreshCustomerNotifications'));
      } catch (err) {
        console.error('Error marking call logs as read:', err);
      }
    };
    
    markCallLogsAsRead();
  }, [startDate, endDate]);

  const fetchCallLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('customerToken');
      
      const params: any = {
        limit: 100,
        offset: 0,
      };

      // Add date filters if set
      // Format dates as yyyy-MM-dd (date-fns format uses local timezone, which is what we want for display)
      // Backend will interpret these as UTC dates for consistent filtering
      if (startDate) {
        const start = startOfDay(startDate);
        params.startDate = format(start, 'yyyy-MM-dd');
      }
      if (endDate) {
        const end = endOfDay(endDate);
        params.endDate = format(end, 'yyyy-MM-dd');
      }
      
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/twilio/call-logs`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      
      const params: any = {};
      
      // Add date filters if set
      if (startDate) {
        const start = startOfDay(startDate);
        params.startDate = format(start, 'yyyy-MM-dd');
      }
      if (endDate) {
        const end = endOfDay(endDate);
        params.endDate = format(end, 'yyyy-MM-dd');
      }
      
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/twilio/call-logs/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });

      setStats(response.data);
    } catch (err: any) {
      console.error('Error fetching call stats:', err);
      // Don't set error for stats, just log it
    }
  };

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/twilio/configuration`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setConfig(response.data);
    } catch (err: any) {
      console.error('Error fetching Twilio configuration:', err);
      // Don't set error for config, just log it
    }
  };

  const fetchSummary = async (callSid: string) => {
    try {
      setLoadingSummary(true);
      setSummaryText(null);
      const token = localStorage.getItem('customerToken');
      
      if (!token) {
        setLoadingSummary(false);
        return;
      }
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/twilio/call-logs/${callSid}/summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.data.summaryText) {
        setSummaryText(response.data.summaryText);
      }
      
      // Update the call log in the list if appointment status was determined
      if (response.data.appointmentBooked !== undefined) {
        setCallLogs(prevLogs => 
          prevLogs.map(log => 
            log.callSid === callSid 
              ? { ...log, appointmentBooked: response.data.appointmentBooked }
              : log
          )
        );
        // Refresh stats to update appointment count
        fetchStats();
      }
    } catch (err: any) {
      console.error('Error fetching summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
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

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusIcon = (dialCallStatus: string | null, status: string) => {
    // Use dialCallStatus if available (more accurate for forwarded calls)
    if (dialCallStatus) {
      if (dialCallStatus === 'answered') {
        return <FaCheckCircle className="text-green-500" />;
      } else if (dialCallStatus === 'no-answer' || dialCallStatus === 'busy' || 
                 dialCallStatus === 'failed' || dialCallStatus === 'canceled') {
        return <FaTimesCircle className="text-red-500" />;
      }
    }
    // Fallback to status if dialCallStatus is not available
    switch (status) {
      case 'completed':
        return <FaCheckCircle className="text-green-500" />;
      case 'failed':
      case 'busy':
      case 'no-answer':
      case 'canceled':
        return <FaTimesCircle className="text-red-500" />;
      default:
        return <FaClock className="text-yellow-500" />;
    }
  };

  const getStatusLabel = (dialCallStatus: string | null, status: string, duration: number = 0) => {
    // Use dialCallStatus if available (more accurate for forwarded calls)
    if (dialCallStatus) {
      if (dialCallStatus === 'answered') {
        return 'Answered';
      } else if (dialCallStatus === 'no-answer' || dialCallStatus === 'busy' || 
                 dialCallStatus === 'failed' || dialCallStatus === 'canceled') {
        // All non-answered statuses should show as "Missed"
        return 'Missed';
      } else if (dialCallStatus === 'completed') {
        // If completed with duration > 0, it was answered
        // If completed with duration = 0, it was not answered (missed)
        return duration > 0 ? 'Answered' : 'Missed';
      }
    }
    // Fallback to status if dialCallStatus is not available
    // If status is 'completed' but no dialCallStatus, check duration to determine if answered
    if (status === 'completed') {
      // If duration > 0, it was answered; otherwise missed
      return duration > 0 ? 'Answered' : 'Missed';
    }
    // For other non-answered statuses, show as "Missed"
    if (status === 'failed' || status === 'busy' || status === 'no-answer' || status === 'canceled') {
      return 'Missed';
    }
    // For in-progress statuses, show actual status
    if (status === 'ringing' || status === 'in-progress') {
      return status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ');
    }
    return status;
  };

  // Date filter handlers
  const handlePast7Days = () => {
    const today = new Date();
    const sevenDaysAgo = subDays(today, 6); // Include today, so 6 days ago + today = 7 days
    setStartDate(startOfDay(sevenDaysAgo));
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
    // Store temporary dates without applying filter
    if (!dates) {
      setTempStartDate(null);
      setTempEndDate(null);
      return;
    }
    
    // Handle array of dates from DatePicker
    const dateArray = Array.isArray(dates) ? dates : [dates];
    const validDates = dateArray
      .filter((d: any) => d !== null && d !== undefined)
      .map((d: any) => {
        // Handle Dayjs objects or Date objects from react-multi-date-picker
        if (d && typeof d.toDate === 'function') {
          return d.toDate();
        } else if (d instanceof Date) {
          return d;
        } else if (d && typeof d === 'object' && d.year && d.month && d.day) {
          // Handle DateObject from react-multi-date-picker
          return new Date(d.year, d.month - 1, d.day);
        } else if (d && d.format) {
          // Handle moment-like objects
          return new Date(d.format('YYYY-MM-DD'));
        }
        return new Date(d);
      })
      .filter((d: Date) => !isNaN(d.getTime()));
    
    // Store temporary dates (don't apply filter yet)
    if (validDates.length === 2) {
      const sortedDates = validDates.sort((a, b) => a.getTime() - b.getTime());
      setTempStartDate(sortedDates[0]);
      setTempEndDate(sortedDates[1]);
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
      // If only one date selected, use it as both start and end
      setStartDate(startOfDay(tempStartDate));
      setEndDate(endOfDay(tempStartDate));
      setActiveFilter('custom');
    }
  };

  // Get filter display text
  const getFilterDisplayText = () => {
    if (activeFilter === 'all') {
      return 'All Calls';
    } else if (activeFilter === 'past7days') {
      return `Past 7 Days (${format(startDate!, 'MMM d')} - ${format(endDate!, 'MMM d, yyyy')})`;
    } else if (activeFilter === 'month' && startDate && endDate) {
      return `${format(startDate, 'MMMM yyyy')}`;
    } else if (activeFilter === 'custom' && startDate && endDate) {
      if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
        return format(startDate, 'MMMM d, yyyy');
      }
      return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
    }
    return 'All Calls';
  };

  const handleDeleteAllLogs = async () => {
    // Confirmation dialog
    const confirmMessage = `Are you sure you want to delete ALL call logs?\n\nThis action cannot be undone and will delete all call history, recordings, and statistics.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    // Double confirmation
    const doubleConfirm = window.confirm(`FINAL CONFIRMATION: Delete ALL call logs?\n\nThis will permanently delete all call history.`);
    
    if (!doubleConfirm) {
      return;
    }
    
    try {
      setDeletingLogs(true);
      const token = localStorage.getItem('customerToken');
      
      const response = await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/twilio/call-logs`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`Successfully deleted ${response.data.deletedCount} call log${response.data.deletedCount !== 1 ? 's' : ''}`);
      
      // Refresh the page to show empty state
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to delete call logs:', err);
      alert(err.response?.data?.error || 'Failed to delete call logs');
    } finally {
      setDeletingLogs(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen">
        <FaSpinner className="animate-spin text-3xl text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen overflow-x-hidden">
      <div className="w-full mx-auto max-w-full xl:max-w-7xl 2xl:max-w-7xl">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaPhone className="text-blue-500" />
            Call Logs
          </h1>
          <p className="text-sm text-gray-600 mt-1">View all incoming calls and track patient inquiries</p>
        </div>

        {/* Twilio Configuration Card */}
        {config && config.isConnected && (
          <div className="bg-white rounded-lg shadow mb-4 p-4 border-l-4 border-blue-500">
            <div className="flex items-start gap-3">
              <FaInfoCircle className="text-blue-500 text-xl mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Call Tracking Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-600 font-medium">Tracking Number:</p>
                    <p className="text-gray-900 font-mono mt-0.5">{config.twilioPhoneNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 font-medium">Forward Number:</p>
                    <p className="text-gray-900 font-mono mt-0.5">
                      {config.twilioForwardNumber || config.twilioForwardNumberNew || config.twilioForwardNumberExisting || 'Not set'}
                    </p>
                    {config.twilioForwardNumberNew && config.twilioForwardNumberExisting && config.twilioForwardNumberNew !== config.twilioForwardNumberExisting && (
                      <p className="text-gray-500 text-xs mt-1">
                        New: {config.twilioForwardNumberNew} | Existing: {config.twilioForwardNumberExisting}
                      </p>
                    )}
                  </div>
                  {config.menuEnabled && (
                    <div className="md:col-span-2">
                      <p className="text-gray-600 font-medium">Menu Message:</p>
                      <p className="text-gray-900 mt-0.5 italic">"{config.twilioMenuMessage}"</p>
                    </div>
                  )}
                  {config.recordingEnabled && (
                    <div className="md:col-span-2">
                      <p className="text-green-600 font-medium flex items-center gap-1">
                        <FaHeadphones className="text-xs" />
                        Call Recording: Enabled
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {config && !config.isConnected && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4 text-sm">
            <p className="flex items-center gap-2">
              <FaInfoCircle />
              Twilio phone number is not connected. Please contact your administrator to set up call tracking.
            </p>
          </div>
        )}

        {/* Date Filters */}
        <div className="bg-white rounded-lg shadow mb-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <FaFilter className="text-blue-500" />
              Filter Calls
            </h3>
            {(startDate || endDate) && (
              <button
                onClick={handleClearFilter}
                className="text-xs text-gray-600 hover:text-gray-800 underline"
              >
                Clear Filter
              </button>
            )}
          </div>
          
          {/* Active Filter Display */}
          {(startDate || endDate) && (
            <div className="mb-3 p-2 bg-blue-50 rounded text-sm border border-blue-200">
              <span className="font-medium text-gray-800">Active Filter: </span>
              <span className="text-blue-700 font-semibold">{getFilterDisplayText()}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {/* Past 7 Days Button */}
            <button
              onClick={handlePast7Days}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'past7days'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Past 7 Days
            </button>

            {/* This Month Button */}
            <button
              onClick={handleThisMonth}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'month' && startDate && format(startDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM')
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              This Month
            </button>

            {/* Last Month Button */}
            <button
              onClick={handleLastMonth}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'month' && startDate && format(startDate, 'yyyy-MM') === format(subMonths(new Date(), 1), 'yyyy-MM')
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last Month
            </button>

            {/* Custom Date Range Picker */}
            <div className="flex items-center gap-2 flex-wrap">
              <FaCalendar className="text-gray-600 text-sm" />
              <span className="text-sm text-gray-800 font-medium whitespace-nowrap">Custom Range:</span>
              <div className="flex items-center gap-2">
                <div className="min-w-[280px]">
                  <DatePicker
                    value={
                      (tempStartDate && tempEndDate) 
                        ? [tempStartDate, tempEndDate] 
                        : tempStartDate 
                          ? [tempStartDate] 
                          : (startDate && endDate) 
                            ? [startDate, endDate] 
                            : undefined
                    }
                    onChange={handleCustomDateRangeChange}
                    range
                    rangeHover
                    numberOfMonths={2}
                    format="MMM D, YYYY"
                    className="rmdp-wrapper w-full"
                    inputClass="!bg-white !border !border-gray-300 !rounded !px-3 !py-1.5 !text-sm !text-gray-900 !w-full !focus:outline-none !focus:ring-2 !focus:ring-blue-500 !focus:border-blue-500"
                    containerClassName="!text-gray-900"
                    placeholder="Select start date, then end date"
                    calendarPosition="bottom-start"
                    maxDate={new Date()}
                    editable={false}
                    showOtherDays
                  />
                </div>
                <button
                  onClick={handleApplyCustomRange}
                  disabled={!tempStartDate || !tempEndDate}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tempStartDate && tempEndDate
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white p-3 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Total Calls</p>
                  <p className="text-xl font-bold text-gray-800">{stats.totalCalls}</p>
                </div>
                <FaPhone className="text-blue-500 text-xl" />
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Answered</p>
                  <p className="text-xl font-bold text-green-600">{stats.completedCalls}</p>
                </div>
                <FaCheckCircle className="text-green-500 text-xl" />
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Missed</p>
                  <p className="text-xl font-bold text-red-600">{stats.missedCalls}</p>
                </div>
                <FaTimesCircle className="text-red-500 text-xl" />
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg shadow border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Appointments</p>
                  <p className="text-xl font-bold text-purple-600">{stats.appointmentsBooked || 0}</p>
                </div>
                <FaCalendarCheck className="text-purple-500 text-xl" />
              </div>
            </div>
          </div>
        )}

        {/* Menu Choice Stats - Always show patient type breakdown */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div className="bg-white p-3 rounded-lg shadow border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-medium">New Patients (Pressed 1)</p>
                  <p className="text-xl font-bold text-blue-600 mt-1">{stats.newPatientCalls}</p>
                  {stats.totalCalls > 0 ? (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {Math.round((stats.newPatientCalls / stats.totalCalls) * 100)}% of total calls
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-0.5">No calls yet</p>
                  )}
                </div>
                <FaUser className="text-blue-500 text-xl" />
              </div>
            </div>

            <div className="bg-white p-3 rounded-lg shadow border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 font-medium">Existing Patients (Pressed 2)</p>
                  <p className="text-xl font-bold text-green-600 mt-1">{stats.existingPatientCalls}</p>
                  {stats.totalCalls > 0 ? (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {Math.round((stats.existingPatientCalls / stats.totalCalls) * 100)}% of total calls
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-0.5">No calls yet</p>
                  )}
                </div>
                <FaUser className="text-green-500 text-xl" />
              </div>
            </div>
          </div>
        )}

        {/* Call Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Recent Calls</h2>
            {stats && (
              <p className="text-xs text-gray-600 mt-1">
                Showing {callLogs.length} of {stats.totalCalls} calls
              </p>
            )}
          </div>

          {callLogs.length === 0 ? (
            <div className="p-8 text-center">
              <FaPhone className="text-3xl text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">No call logs found</p>
              <p className="text-xs text-gray-500 mt-1">Calls will appear here once they are received</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      From
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient Type
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Appointment
                    </th>
                    {config?.recordingEnabled && (
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recording
                      </th>
                    )}
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {callLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaCalendar className="text-gray-400 mr-1.5 text-xs" />
                          <span className="text-xs text-gray-900">{formatDate(log.startedAt)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex flex-col">
                          <div className="flex items-center">
                            <FaPhone className="text-gray-400 mr-1.5 text-xs" />
                            <span className="text-xs text-gray-900 font-mono">{log.from}</span>
                          </div>
                          {log.callerName && (
                            <span className="text-xs text-gray-600 mt-0.5">{log.callerName}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-xs">{getStatusIcon(log.dialCallStatus, log.status)}</span>
                          <span className="text-xs text-gray-900 ml-1.5">{getStatusLabel(log.dialCallStatus, log.status, log.duration)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <FaClock className="text-gray-400 mr-1.5 text-xs" />
                          <span className="text-xs text-gray-900">{formatDuration(log.duration)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {log.menuChoiceLabel ? (
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            log.menuChoice === '1' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {log.menuChoiceLabel}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {log.callerCity || log.callerState ? (
                          <div className="flex items-center text-xs text-gray-600">
                            <FaMapMarkerAlt className="mr-1 text-xs" />
                            <span>{[log.callerCity, log.callerState].filter(Boolean).join(', ') || '—'}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {log.appointmentBooked === true ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            <FaCalendarCheck className="mr-1 text-xs" />
                            Booked
                          </span>
                        ) : log.appointmentBooked === false ? (
                          <span className="text-xs text-gray-400">No</span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      {config?.recordingEnabled && (
                        <td className="px-3 py-2 whitespace-nowrap">
                          {/* Show voicemail for missed calls */}
                          {log.dialCallStatus && log.dialCallStatus !== 'answered' && log.voicemailUrl ? (
                            <button
                              onClick={async () => {
                                try {
                                  setLoadingRecording(true);
                                  setSelectedCall(log);
                                  setShowRecordingModal(true);
                                  
                                  const token = localStorage.getItem('customerToken');
                                  if (!token) {
                                    alert('Please log in to access voicemail');
                                    setShowRecordingModal(false);
                                    return;
                                  }
                                  
                                  // Use voicemail endpoint for missed calls
                                  // Hardcode production URL for audio endpoints to fix CORS issues
                                  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
                                  const isProduction = hostname === 'www.clinimediaportal.ca' || 
                                                       hostname === 'clinimediaportal.ca' || 
                                                       hostname.includes('clinimediaportal.ca');
                                  const audioApiBaseUrl = isProduction 
                                    ? 'https://api.clinimediaportal.ca' 
                                    : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');
                                  const voicemailApiUrl = `${audioApiBaseUrl}/api/twilio/voicemail/${log.callSid}`;
                                  
                                  console.log('Fetching voicemail from:', voicemailApiUrl);
                                  
                                  // Fetch voicemail with credentials
                                  const response = await fetch(voicemailApiUrl, {
                                    method: 'GET',
                                    headers: {
                                      'Authorization': `Bearer ${token}`
                                    },
                                    credentials: 'include' // Include credentials for CORS
                                  });
                                  
                                  console.log('Voicemail response status:', response.status, response.statusText);
                                  
                                  if (!response.ok) {
                                    const errorText = await response.text().catch(() => 'Unknown error');
                                    console.error('Voicemail fetch failed:', response.status, errorText);
                                    alert(`Failed to load voicemail (${response.status}): ${errorText}`);
                                    setShowRecordingModal(false);
                                    return;
                                  }
                                  
                                  // Validate content type
                                  const contentType = response.headers.get('content-type');
                                  if (!contentType || !contentType.includes('audio')) {
                                    console.error('Invalid content type:', contentType);
                                    alert('Invalid response format. Expected audio file.');
                                    setShowRecordingModal(false);
                                    return;
                                  }
                                  
                                  const blob = await response.blob();
                                  
                                  // Validate blob
                                  if (!blob || blob.size === 0) {
                                    console.error('Voicemail blob is empty');
                                    alert('Voicemail file is empty or corrupted.');
                                    setShowRecordingModal(false);
                                    return;
                                  }
                                  
                                  console.log('Voicemail loaded successfully, size:', blob.size, 'bytes');
                                  const blobUrl = URL.createObjectURL(blob);
                                  setRecordingUrl(blobUrl);
                                } catch (error) {
                                  console.error('Error loading voicemail:', error);
                                  alert('Failed to load voicemail');
                                  setShowRecordingModal(false);
                                } finally {
                                  setLoadingRecording(false);
                                }
                              }}
                              className="text-purple-600 hover:text-purple-800 text-xs flex items-center gap-1 cursor-pointer underline"
                              title="Listen to voicemail"
                            >
                              <FaHeadphones className="text-xs" />
                              Voicemail
                            </button>
                          ) : log.recordingSid && log.dialCallStatus === 'answered' ? (
                            <button
                              onClick={async () => {
                                try {
                                  setLoadingRecording(true);
                                  setSelectedCall(log);
                                  setShowRecordingModal(true);
                                  
                                  const token = localStorage.getItem('customerToken');
                                  if (!token) {
                                    alert('Please log in to access recordings');
                                    setShowRecordingModal(false);
                                    return;
                                  }
                                  
                                  // Hardcode production URL for audio endpoints to fix CORS issues
                                  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
                                  const isProduction = hostname === 'www.clinimediaportal.ca' || 
                                                       hostname === 'clinimediaportal.ca' || 
                                                       hostname.includes('clinimediaportal.ca');
                                  const audioApiBaseUrl = isProduction 
                                    ? 'https://api.clinimediaportal.ca' 
                                    : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000');
                                  const recordingApiUrl = `${audioApiBaseUrl}/api/twilio/recording/${log.recordingSid}`;
                                  
                                  console.log('Fetching recording from:', recordingApiUrl);
                                  
                                  // Fetch recording with credentials
                                  const response = await fetch(recordingApiUrl, {
                                    method: 'GET',
                                    headers: {
                                      'Authorization': `Bearer ${token}`
                                    },
                                    credentials: 'include' // Include credentials for CORS
                                  });
                                  
                                  console.log('Recording response status:', response.status, response.statusText);
                                  
                                  if (!response.ok) {
                                    const errorText = await response.text().catch(() => 'Unknown error');
                                    console.error('Recording fetch failed:', response.status, errorText);
                                    alert(`Failed to load recording (${response.status}): ${errorText}`);
                                    setShowRecordingModal(false);
                                    return;
                                  }
                                  
                                  // Validate content type
                                  const contentType = response.headers.get('content-type');
                                  if (!contentType || !contentType.includes('audio')) {
                                    console.error('Invalid content type:', contentType);
                                    alert('Invalid response format. Expected audio file.');
                                    setShowRecordingModal(false);
                                    return;
                                  }
                                  
                                  const blob = await response.blob();
                                  
                                  // Validate blob
                                  if (!blob || blob.size === 0) {
                                    console.error('Recording blob is empty');
                                    alert('Recording file is empty or corrupted.');
                                    setShowRecordingModal(false);
                                    return;
                                  }
                                  
                                  console.log('Recording loaded successfully, size:', blob.size, 'bytes');
                                  const blobUrl = URL.createObjectURL(blob);
                                  setRecordingUrl(blobUrl);
                                } catch (error) {
                                  console.error('Error loading recording:', error);
                                  alert('Failed to load recording');
                                  setShowRecordingModal(false);
                                } finally {
                                  setLoadingRecording(false);
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 cursor-pointer underline"
                              title="Listen to recording"
                            >
                              <FaHeadphones className="text-xs" />
                              Listen
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCall(log);
                            setShowCallDetails(true);
                            setSummaryText(null);
                            if (log.transcriptSid || config?.recordingEnabled) {
                              fetchSummary(log.callSid);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                        >
                          <FaEye className="text-xs" />
                          Summary
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recording Player Modal */}
      {showRecordingModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            // Close modal if clicking outside
            if (e.target === e.currentTarget) {
              setShowRecordingModal(false);
              setRecordingUrl(null);
              setSelectedCall(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaHeadphones className={selectedCall && selectedCall.dialCallStatus && selectedCall.dialCallStatus !== 'answered' && selectedCall.voicemailUrl ? "text-purple-500" : "text-blue-500"} />
                {selectedCall && selectedCall.dialCallStatus && selectedCall.dialCallStatus !== 'answered' && selectedCall.voicemailUrl ? 'Voicemail' : 'Call Recording'}
              </h2>
              <button
                onClick={() => {
                  setShowRecordingModal(false);
                  setRecordingUrl(null);
                  setSelectedCall(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            {/* Recording Info */}
            {selectedCall && (
              <div className="mb-4 text-sm text-gray-600">
                <p><span className="font-medium">Call from:</span> {selectedCall.from}</p>
                <p><span className="font-medium">Date:</span> {formatDate(selectedCall.startedAt)}</p>
                <p><span className="font-medium">Duration:</span> {formatDuration(selectedCall.duration)}</p>
              </div>
            )}

            {/* Audio Player */}
            <div className="mt-4">
              {loadingRecording ? (
                <div className="flex items-center justify-center py-8">
                  <FaSpinner className="animate-spin text-blue-500 text-2xl" />
                  <span className="ml-2 text-gray-600">Loading recording...</span>
                </div>
              ) : recordingUrl ? (
                <audio 
                  controls 
                  autoPlay
                  className="w-full"
                  onEnded={() => {
                    // Clean up blob URL when playback ends
                    URL.revokeObjectURL(recordingUrl);
                  }}
                >
                  <source src={recordingUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              ) : (
                <p className="text-gray-500 text-center py-8">No recording available</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  if (recordingUrl) {
                    URL.revokeObjectURL(recordingUrl);
                  }
                  setShowRecordingModal(false);
                  setRecordingUrl(null);
                  setSelectedCall(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Details Modal - Simple like Recording Modal */}
      {showCallDetails && selectedCall && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCallDetails(false);
              setSelectedCall(null);
              setSummaryText(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaFileAlt className="text-blue-500" />
                Call Summary
              </h2>
              <button
                onClick={() => {
                  setShowCallDetails(false);
                  setSelectedCall(null);
                  setSummaryText(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            {/* Call Info */}
            <div className="mb-4 text-sm text-gray-600">
              <p><span className="font-medium">Call from:</span> {selectedCall.from}</p>
              <p><span className="font-medium">Date:</span> {formatDate(selectedCall.startedAt)}</p>
              <p><span className="font-medium">Duration:</span> {formatDuration(selectedCall.duration)}</p>
            </div>

            {/* Summary Content */}
            <div className="mt-4">
              {loadingSummary ? (
                <div className="flex items-center justify-center py-8">
                  <FaSpinner className="animate-spin text-blue-500 text-2xl" />
                  <span className="ml-2 text-gray-600">Loading conversation summary...</span>
                </div>
              ) : summaryText ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{summaryText}</p>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No summary available</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowCallDetails(false);
                  setSelectedCall(null);
                  setSummaryText(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Button - Fixed at bottom right */}
      <button
        onClick={handleDeleteAllLogs}
        disabled={deletingLogs}
        className="fixed bottom-6 right-6 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium transition-colors z-50"
        title="Delete all call logs"
      >
        {deletingLogs ? (
          <>
            <FaSpinner className="animate-spin" /> Deleting...
          </>
        ) : (
          <>
            <FaTrash /> Reset Logs
          </>
        )}
      </button>
    </div>
  );
};

export default CallLogsPage;

