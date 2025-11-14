import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaFacebook, FaEnvelope, FaPhone, FaCalendar, FaCheckCircle, FaTimesCircle, FaClock, FaUser, FaMapMarkerAlt, FaCalendarCheck, FaEdit, FaSpinner, FaFilter, FaEye, FaTimes } from 'react-icons/fa';
import { startOfMonth, endOfMonth, subMonths, format, startOfDay, endOfDay, subDays } from 'date-fns';
import DatePicker from 'react-multi-date-picker';

interface MetaLead {
  _id: string;
  emailSubject: string;
  leadInfo: {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    fields?: any;
  };
  emailDate: string;
  emailFrom?: string;
  status: 'new' | 'contacted' | 'not_contacted';
  contactedAt?: string;
  notContactedAt?: string;
  notContactedReason?: string;
  appointmentBooked?: boolean;
  appointmentBookedAt?: string;
  appointmentBookingReason?: string;
  notes?: string;
}

interface LeadStats {
  totalLeads: number;
  contactedLeads: number;
  bookedAppointments: number;
  monthlyStats: Array<{ year: number; month: number; total: number; contacted: number; booked: number }>;
}

const MetaLeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<MetaLead | null>(null);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<'contacted' | 'not_contacted'>('contacted');
  const [notContactedReason, setNotContactedReason] = useState('');
  const [appointmentBooked, setAppointmentBooked] = useState<boolean | null>(null);
  const [appointmentReason, setAppointmentReason] = useState('');
  const [notes, setNotes] = useState('');
  const [showAppointmentSection, setShowAppointmentSection] = useState(false);
  const [editContactStatus, setEditContactStatus] = useState(false);
  const [editAppointmentStatus, setEditAppointmentStatus] = useState(false);

  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, [startDate, endDate, selectedStatus]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('customerToken');
      if (!token) return;

      const params: any = {
        limit: 100,
        page: 1,
      };

      // Add date filters - always use startDate and endDate if both are set
      // Backend prefers date range over month/year
      if (startDate && endDate) {
        // Format dates as YYYY-MM-DD and ensure they're at start/end of day
        params.startDate = format(startOfDay(startDate), 'yyyy-MM-dd');
        params.endDate = format(endOfDay(endDate), 'yyyy-MM-dd');
      }
      // Don't send month/year params if we have a date range - backend will use date range

      // Add status filter
      if (selectedStatus !== 'all') {
        params.status = selectedStatus;
      }

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/meta-leads/customer/leads`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          params
        }
      );

      setLeads(response.data.leads || []);
    } catch (err: any) {
      console.error('Error fetching leads:', err);
      setError(err.response?.data?.message || 'Failed to fetch leads');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) return;

      const params: any = {};
      
      // Add date filters - always use startDate and endDate if both are set
      // Backend prefers date range over month/year
      if (startDate && endDate) {
        // Format dates as YYYY-MM-DD and ensure they're at start/end of day
        params.startDate = format(startOfDay(startDate), 'yyyy-MM-dd');
        params.endDate = format(endOfDay(endDate), 'yyyy-MM-dd');
      }
      // Don't send month/year params if we have a date range - backend will use date range

      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/meta-leads/customer/stats`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          params
        }
      );

      setStats(response.data);
    } catch (err: any) {
      console.error('Error fetching lead stats:', err);
    }
  };


  const handleStatusUpdate = async (leadId: string, status: 'contacted' | 'not_contacted', reason?: string) => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) return;

      // Validate reason is provided for "not_contacted"
      if (status === 'not_contacted' && !reason?.trim()) {
        // Use notContactedReason from state if reason parameter not provided
        const stateReason = notContactedReason?.trim();
        if (!stateReason) {
          alert('A reason is required for not contacting a lead');
          return;
        }
        reason = stateReason;
      }

      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/meta-leads/customer/leads/${leadId}/status`,
        { status, reason: status === 'not_contacted' ? reason : undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // If status is "contacted", show appointment section and keep modal open
      if (status === 'contacted') {
        setShowAppointmentSection(true);
        setEditContactStatus(false); // Close edit section after update
        // Update the selected lead status in state
        if (selectedLead) {
          setSelectedLead({ ...selectedLead, status: 'contacted' });
        }
        // Fetch leads to get updated data but keep modal open
        fetchLeads();
        fetchStats();
      } else {
        // If "not_contacted", close modal and refresh
        setNotContactedReason('');
        setEditContactStatus(false);
        setShowLeadDetails(false);
        setSelectedLead(null);
        fetchLeads();
        fetchStats();
      }
    } catch (error: any) {
      console.error('Failed to update status:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update status';
      alert(errorMessage);
    }
  };

  const handleAppointmentUpdate = async (leadId: string) => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) return;

      // Validate that appointmentBooked is set
      if (appointmentBooked === null || appointmentBooked === undefined) {
        alert('Please select whether an appointment was booked');
        return;
      }

      // Require reason if appointment was not booked
      if (appointmentBooked === false && !appointmentReason.trim()) {
        alert('Please provide a reason why the appointment was not booked');
        return;
      }

      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/meta-leads/customer/leads/${leadId}/appointment`,
        {
          appointmentBooked,
          reason: appointmentReason
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Close appointment edit section after update
      setEditAppointmentStatus(false);
      // Update the selected lead appointment status in state
      if (selectedLead) {
        setSelectedLead({ ...selectedLead, appointmentBooked, appointmentBookingReason: appointmentReason || undefined });
      }
      // Keep modal open but refresh data
      fetchLeads();
      fetchStats();
    } catch (error: any) {
      console.error('Failed to update appointment:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update appointment status';
      alert(errorMessage);
    }
  };

  const handleNotesUpdate = async (leadId: string) => {
    try {
      const token = localStorage.getItem('customerToken');
      if (!token) return;

      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/meta-leads/customer/leads/${leadId}/notes`,
        { notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowLeadDetails(false);
      fetchLeads();
    } catch (error) {
      console.error('Failed to update notes:', error);
      alert('Failed to update notes');
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'contacted':
        return <FaCheckCircle className="text-green-500" />;
      case 'not_contacted':
        return <FaTimesCircle className="text-red-500" />;
      case 'new':
      default:
        return <FaClock className="text-yellow-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'contacted':
        return 'Contacted';
      case 'not_contacted':
        return 'Not Contacted';
      case 'new':
      default:
        return 'New';
    }
  };

  // Date filter handlers
  const handlePast7Days = () => {
    const today = new Date();
    // Past 7 days: from 7 days ago (including today makes it 8 days, so go back 6 days to get 7 total)
    const sevenDaysAgo = subDays(today, 6);
    setStartDate(startOfDay(sevenDaysAgo));
    setEndDate(endOfDay(today));
    setTempStartDate(null);
    setTempEndDate(null);
    setActiveFilter('past7days');
  };

  const handleThisMonth = () => {
    const today = new Date();
    setStartDate(startOfDay(startOfMonth(today)));
    setEndDate(endOfDay(endOfMonth(today)));
    setTempStartDate(null);
    setTempEndDate(null);
    setActiveFilter('month');
  };

  const handleLastMonth = () => {
    const today = new Date();
    const lastMonth = subMonths(today, 1);
    setStartDate(startOfDay(startOfMonth(lastMonth)));
    setEndDate(endOfDay(endOfMonth(lastMonth)));
    setTempStartDate(null);
    setTempEndDate(null);
    setActiveFilter('month');
  };

  const handleClearFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setTempStartDate(null);
    setTempEndDate(null);
    setActiveFilter('all');
    setSelectedStatus('all');
  };

  const handleCustomDateRangeChange = (dates: any) => {
    if (!dates) {
      setTempStartDate(null);
      setTempEndDate(null);
      return;
    }
    
    const dateArray = Array.isArray(dates) ? dates : [dates];
    const validDates = dateArray
      .filter((d: any) => d !== null && d !== undefined)
      .map((d: any) => {
        if (d && typeof d.toDate === 'function') {
          return d.toDate();
        } else if (d instanceof Date) {
          return d;
        } else if (d && typeof d === 'object' && d.year && d.month && d.day) {
          return new Date(d.year, d.month - 1, d.day);
        } else if (d && d.format) {
          return new Date(d.format('YYYY-MM-DD'));
        }
        return new Date(d);
      })
      .filter((d: Date) => !isNaN(d.getTime()));
    
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
      // Ensure dates are at start and end of day for proper filtering
      setStartDate(startOfDay(tempStartDate));
      setEndDate(endOfDay(tempEndDate));
      setTempStartDate(null);
      setTempEndDate(null);
      setActiveFilter('custom');
    } else if (tempStartDate) {
      // If only one date selected, use it for both start and end
      setStartDate(startOfDay(tempStartDate));
      setEndDate(endOfDay(tempStartDate));
      setTempStartDate(null);
      setTempEndDate(null);
      setActiveFilter('custom');
    }
  };

  const getFilterDisplayText = () => {
    if (activeFilter === 'all') {
      return 'All Leads';
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
    return 'All Leads';
  };

  const openLeadDetails = (lead: MetaLead) => {
    setSelectedLead(lead);
    // Set status based on current lead status, default to 'contacted' for new leads
    if (lead.status === 'new') {
      setStatusUpdate('contacted');
      setShowAppointmentSection(false);
      setEditContactStatus(true); // Show contact edit section for new leads
      setEditAppointmentStatus(false);
    } else {
      setStatusUpdate(lead.status);
      setShowAppointmentSection(lead.status === 'contacted');
      setEditContactStatus(false); // Hide edit sections by default for existing leads
      setEditAppointmentStatus(false);
    }
    setNotContactedReason(lead.notContactedReason || '');
    setAppointmentBooked(lead.appointmentBooked ?? null);
    setAppointmentReason(lead.appointmentBookingReason || '');
    setNotes(lead.notes || '');
    setShowLeadDetails(true);
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen">
        <FaSpinner className="animate-spin text-3xl text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaFacebook className="text-blue-500" />
            Meta Leads
          </h1>
          <p className="text-sm text-gray-600 mt-1">View all incoming leads from Facebook and track patient inquiries</p>
        </div>

        {/* Date Filters */}
        <div className="bg-white rounded-lg shadow mb-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <FaFilter className="text-blue-500" />
              Filter Leads
            </h3>
            {(startDate || endDate || selectedStatus !== 'all') && (
              <button
                onClick={handleClearFilter}
                className="text-xs text-gray-600 hover:text-gray-800 underline"
              >
                Clear Filter
              </button>
            )}
          </div>
          
          {/* Active Filter Display */}
          {(startDate || endDate || selectedStatus !== 'all') && (
            <div className="mb-3 p-2 bg-blue-50 rounded text-sm border border-blue-200">
              <span className="font-medium text-gray-800">Active Filter: </span>
              <span className="text-blue-700 font-semibold">{getFilterDisplayText()}</span>
              {selectedStatus !== 'all' && (
                <span className="text-blue-700 font-semibold ml-2">• Status: {getStatusLabel(selectedStatus)}</span>
              )}
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

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-800 font-medium">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                style={{ color: '#111827' }}
              >
                <option value="all" style={{ color: '#111827' }}>All Statuses</option>
                <option value="new" style={{ color: '#111827' }}>New</option>
                <option value="contacted" style={{ color: '#111827' }}>Contacted</option>
                <option value="not_contacted" style={{ color: '#111827' }}>Not Contacted</option>
              </select>
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
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white p-3 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Total Leads</p>
                    <p className="text-xl font-bold text-gray-800">{stats.totalLeads}</p>
                  </div>
                  <FaFacebook className="text-blue-500 text-xl" />
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Contacted</p>
                    <p className="text-xl font-bold text-green-600">{stats.contactedLeads}</p>
                  </div>
                  <FaCheckCircle className="text-green-500 text-xl" />
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Not Contacted</p>
                    <p className="text-xl font-bold text-red-600">{stats.totalLeads - stats.contactedLeads}</p>
                  </div>
                  <FaTimesCircle className="text-red-500 text-xl" />
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg shadow border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Appointments</p>
                    <p className="text-xl font-bold text-purple-600">{stats.bookedAppointments || 0}</p>
                  </div>
                  <FaCalendarCheck className="text-purple-500 text-xl" />
                </div>
              </div>
            </div>

            {/* Conversion Rate */}
            {stats && stats.totalLeads > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="bg-white p-3 rounded-lg shadow border-l-4 border-blue-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 font-medium">Contact Rate</p>
                      <p className="text-xl font-bold text-blue-600 mt-1">
                        {Math.round((stats.contactedLeads / stats.totalLeads) * 100)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {stats.contactedLeads} of {stats.totalLeads} leads contacted
                      </p>
                    </div>
                    <FaCheckCircle className="text-blue-500 text-xl" />
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg shadow border-l-4 border-purple-500">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 font-medium">Conversion Rate</p>
                      <p className="text-xl font-bold text-purple-600 mt-1">
                        {Math.round((stats.bookedAppointments / stats.totalLeads) * 100)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {stats.bookedAppointments} of {stats.totalLeads} leads booked
                      </p>
                    </div>
                    <FaCalendarCheck className="text-purple-500 text-xl" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Leads Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Recent Leads</h2>
            <p className="text-xs text-gray-600 mt-1">
              {stats ? `Showing ${leads.length} of ${stats.totalLeads} leads` : `Showing ${leads.length} leads`}
            </p>
          </div>

          {leads.length === 0 ? (
            <div className="p-8 text-center">
              <FaFacebook className="text-3xl text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">No leads found</p>
              <p className="text-xs text-gray-500 mt-1">Leads will appear here once they are received from Facebook</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200 min-w-[1200px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[140px]">
                      Received
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[320px]">
                      Lead Info
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                      Status & Timestamps
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">
                      Appointment
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leads.map((lead) => (
                    <tr key={lead._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center">
                            <FaCalendar className="text-blue-500 mr-1.5 text-xs" />
                            <span className="text-xs text-gray-900 font-semibold">Received:</span>
                          </div>
                          <div className="bg-blue-50 p-2 rounded border border-blue-200">
                            <div className="text-xs font-medium text-blue-800 mb-0.5">Date & Time</div>
                            <div className="text-xs text-blue-700 font-mono">{formatDate(lead.emailDate)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col space-y-2">
                          {lead.leadInfo.name ? (
                            <div className="flex items-center">
                              <FaUser className="text-gray-400 mr-2 text-sm" />
                              <span className="text-sm text-gray-900 font-semibold">{lead.leadInfo.name}</span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <FaUser className="text-gray-300 mr-2 text-sm" />
                              <span className="text-sm text-gray-400 italic">No name</span>
                            </div>
                          )}
                          {lead.leadInfo.phone ? (
                            <div className="flex items-center">
                              <FaPhone className="text-gray-400 mr-2 text-sm" />
                              <span className="text-sm text-gray-900 font-mono">{lead.leadInfo.phone}</span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <FaPhone className="text-gray-300 mr-2 text-sm" />
                              <span className="text-sm text-gray-400 italic">No phone</span>
                            </div>
                          )}
                          {lead.leadInfo.email ? (
                            <div className="flex items-center">
                              <FaEnvelope className="text-gray-400 mr-2 text-sm" />
                              <span className="text-sm text-gray-900 truncate max-w-[280px]">{lead.leadInfo.email}</span>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <FaEnvelope className="text-gray-300 mr-2 text-sm" />
                              <span className="text-sm text-gray-400 italic">No email</span>
                            </div>
                          )}
                          {lead.leadInfo.fields?.city && (
                            <div className="flex items-center mt-1">
                              <FaMapMarkerAlt className="text-gray-400 mr-2 text-sm" />
                              <span className="text-sm text-gray-600">{lead.leadInfo.fields.city}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col space-y-1.5">
                          <div className="flex items-center">
                            <span className="text-xs">{getStatusIcon(lead.status)}</span>
                            <span className="text-xs text-gray-900 font-medium ml-1.5">{getStatusLabel(lead.status)}</span>
                          </div>
                          {lead.contactedAt && (
                            <div className="bg-green-50 p-2 rounded border border-green-200">
                              <div className="text-xs font-medium text-green-800 mb-0.5">Contacted At:</div>
                              <div className="text-xs text-green-700">{formatDate(lead.contactedAt)}</div>
                            </div>
                          )}
                          {lead.notContactedAt && (
                            <div className="bg-red-50 p-2 rounded border border-red-200">
                              <div className="text-xs font-medium text-red-800 mb-0.5">Not Contacted At:</div>
                              <div className="text-xs text-red-700 mb-1">{formatDate(lead.notContactedAt)}</div>
                              {lead.notContactedReason && (
                                <div className="text-xs text-red-600 italic mt-1 pt-1 border-t border-red-200">
                                  {lead.notContactedReason.length > 80 ? `${lead.notContactedReason.substring(0, 80)}...` : lead.notContactedReason}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col space-y-1.5">
                          {lead.appointmentBooked === true ? (
                            <div className="bg-purple-50 p-2 rounded border border-purple-200">
                              <div className="flex items-center mb-1">
                                <FaCalendarCheck className="text-purple-600 mr-1 text-xs" />
                                <span className="text-xs font-semibold text-purple-800">Booked</span>
                              </div>
                              {lead.appointmentBookedAt && (
                                <div className="text-xs text-purple-700 mb-1">
                                  Booked At: {formatDate(lead.appointmentBookedAt)}
                                </div>
                              )}
                              {lead.appointmentBookingReason && (
                                <div className="text-xs text-purple-600 italic mt-1 pt-1 border-t border-purple-200">
                                  {lead.appointmentBookingReason.length > 80 ? `${lead.appointmentBookingReason.substring(0, 80)}...` : lead.appointmentBookingReason}
                                </div>
                              )}
                            </div>
                          ) : lead.appointmentBooked === false ? (
                            <div className="bg-orange-50 p-2 rounded border border-orange-200">
                              <div className="text-xs font-semibold text-orange-800 mb-1">Not Booked</div>
                              {lead.appointmentBookingReason && (
                                <div className="text-xs text-orange-700 italic">
                                  {lead.appointmentBookingReason.length > 80 ? `${lead.appointmentBookingReason.substring(0, 80)}...` : lead.appointmentBookingReason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 italic">Not Set</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openLeadDetails(lead)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center gap-2 px-6 py-3 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:scale-105 text-base w-full"
                        >
                          <FaEye className="text-base" />
                          Manage
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

      {/* Lead Details Modal */}
      {showLeadDetails && selectedLead && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLeadDetails(false);
              setSelectedLead(null);
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <FaEdit className="text-blue-500" />
                Manage Lead
              </h2>
              <button
                onClick={() => {
                  setShowLeadDetails(false);
                  setSelectedLead(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            {/* Status Section - Bigger */}
            {!editContactStatus && selectedLead.status !== 'new' && (
              <div className="mb-6 p-6 bg-gray-50 border-2 border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Contact Status</h3>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getStatusIcon(selectedLead.status)}</span>
                      <span className="text-xl font-semibold text-gray-900">{getStatusLabel(selectedLead.status)}</span>
                    </div>
                    {selectedLead.contactedAt && (
                      <p className="text-base text-gray-700 mt-3">
                        <span className="font-semibold">Contacted At:</span>{' '}
                        <span className="text-gray-900">{formatDate(selectedLead.contactedAt)}</span>
                      </p>
                    )}
                    {selectedLead.notContactedAt && (
                      <p className="text-base text-gray-700 mt-3">
                        <span className="font-semibold">Not Contacted At:</span>{' '}
                        <span className="text-gray-900">{formatDate(selectedLead.notContactedAt)}</span>
                      </p>
                    )}
                    {selectedLead.notContactedReason && (
                      <div className="mt-4 p-3 bg-white rounded border border-gray-300">
                        <p className="font-semibold text-gray-900 mb-2">Reason (Not Contacted):</p>
                        <p className="text-base text-gray-700">{selectedLead.notContactedReason}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setEditContactStatus(!editContactStatus);
                      setEditAppointmentStatus(false);
                    }}
                    className="ml-4 px-5 py-3 text-base font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border-2 border-blue-300 transition-colors"
                  >
                    <FaEdit className="inline mr-2" />
                    Edit
                  </button>
                </div>
              </div>
            )}

            {/* Status Update - Show only when edit button is clicked */}
            {(editContactStatus || selectedLead.status === 'new') && (
              <div className="mb-6 p-6 bg-blue-50 border-2 border-blue-300 rounded-lg">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  {selectedLead.status === 'new' ? 'Have you contacted this lead? *' : 'Update Contact Status'}
                </h3>
                <div className="mb-4">
                  <label className="block text-base font-semibold text-gray-700 mb-3">
                    Select your answer:
                  </label>
                  <select
                    value={statusUpdate}
                    onChange={(e) => {
                      setStatusUpdate(e.target.value as 'contacted' | 'not_contacted');
                      if (e.target.value === 'not_contacted') {
                        setShowAppointmentSection(false);
                        setEditAppointmentStatus(false);
                      }
                    }}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                    style={{ color: '#111827' }}
                  >
                    <option value="contacted" style={{ color: '#111827' }}>Yes, I contacted this lead</option>
                    <option value="not_contacted" style={{ color: '#111827' }}>No, I did not contact this lead</option>
                  </select>
                </div>
                
                {/* Show reason input if "not_contacted" is selected */}
                {statusUpdate === 'not_contacted' && (
                  <div className="mt-4">
                    <label className="block text-base font-semibold text-gray-700 mb-2">
                      Please provide a reason why this lead was not contacted: *
                    </label>
                    <textarea
                      value={notContactedReason}
                      onChange={(e) => setNotContactedReason(e.target.value)}
                      placeholder="Enter your reason here..."
                      className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
                      style={{ color: '#111827' }}
                      rows={4}
                      required
                    />
                  </div>
                )}
                
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => handleStatusUpdate(selectedLead._id, statusUpdate)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-base font-semibold"
                  >
                    Update Contact Status
                  </button>
                  {editContactStatus && selectedLead.status !== 'new' && (
                    <button
                      onClick={() => setEditContactStatus(false)}
                      className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-base font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Appointment Section - Bigger (only if contacted) */}
            {selectedLead.status === 'contacted' && !editAppointmentStatus && selectedLead.appointmentBooked !== null && selectedLead.appointmentBooked !== undefined && (
              <div className="mb-6 p-6 bg-purple-50 border-2 border-purple-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Appointment Status</h3>
                    <div className="flex items-center gap-3 mb-2">
                      {selectedLead.appointmentBooked === true ? (
                        <>
                          <FaCalendarCheck className="text-2xl text-purple-600" />
                          <span className="text-xl font-semibold text-purple-700">Booked</span>
                        </>
                      ) : (
                        <span className="text-xl font-semibold text-gray-700">Not Booked</span>
                      )}
                    </div>
                    {selectedLead.appointmentBookedAt && (
                      <p className="text-base text-gray-700 mt-3">
                        <span className="font-semibold">Booked At:</span>{' '}
                        <span className="text-gray-900">{formatDate(selectedLead.appointmentBookedAt)}</span>
                      </p>
                    )}
                    {selectedLead.appointmentBookingReason && (
                      <div className="mt-4 p-3 bg-white rounded border border-purple-300">
                        <p className="font-semibold text-gray-900 mb-2">Reason:</p>
                        <p className="text-base text-gray-700">{selectedLead.appointmentBookingReason}</p>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setEditAppointmentStatus(!editAppointmentStatus);
                      setEditContactStatus(false);
                    }}
                    className="ml-4 px-5 py-3 text-base font-semibold text-purple-600 hover:text-purple-800 hover:bg-purple-100 rounded-lg border-2 border-purple-300 transition-colors"
                  >
                    <FaEdit className="inline mr-2" />
                    Edit
                  </button>
                </div>
              </div>
            )}

            {/* Appointment Status - Show only when edit button is clicked or status is new/contacted and appointment not set */}
            {selectedLead.status === 'contacted' && (editAppointmentStatus || (selectedLead.appointmentBooked === null || selectedLead.appointmentBooked === undefined)) && (
              <div className="mb-6 p-6 bg-purple-50 border-2 border-purple-300 rounded-lg">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Did this contact turn into an appointment? *</h3>
                <div className="flex gap-6 mb-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="appointment"
                      value="yes"
                      checked={appointmentBooked === true}
                      onChange={() => {
                        setAppointmentBooked(true);
                        setAppointmentReason('');
                      }}
                      className="mr-3 w-5 h-5"
                    />
                    <span className="text-gray-900 font-semibold text-base">Yes</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="appointment"
                      value="no"
                      checked={appointmentBooked === false}
                      onChange={() => setAppointmentBooked(false)}
                      className="mr-3 w-5 h-5"
                    />
                    <span className="text-gray-900 font-semibold text-base">No</span>
                  </label>
                </div>
                
                {/* Require reason if "No" is selected */}
                {appointmentBooked === false && (
                  <div className="mb-4">
                    <label className="block text-base font-semibold text-gray-700 mb-2">
                      Why not? *
                    </label>
                    <textarea
                      value={appointmentReason}
                      onChange={(e) => setAppointmentReason(e.target.value)}
                      placeholder="Please provide a reason why the appointment was not booked..."
                      className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
                      style={{ color: '#111827' }}
                      rows={4}
                      required
                    />
                  </div>
                )}
                
                {/* Optional reason if "Yes" is selected */}
                {appointmentBooked === true && (
                  <div className="mb-4">
                    <label className="block text-base font-semibold text-gray-700 mb-2">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      value={appointmentReason}
                      onChange={(e) => setAppointmentReason(e.target.value)}
                      placeholder="Any additional notes about the appointment..."
                      className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white"
                      style={{ color: '#111827' }}
                      rows={3}
                    />
                  </div>
                )}
                
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => handleAppointmentUpdate(selectedLead._id)}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-base font-semibold"
                  >
                    Save Appointment Status
                  </button>
                  {editAppointmentStatus && (selectedLead.appointmentBooked !== null && selectedLead.appointmentBooked !== undefined) && (
                    <button
                      onClick={() => setEditAppointmentStatus(false)}
                      className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 text-base font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowLeadDetails(false);
                  setSelectedLead(null);
                }}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-base font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetaLeadsPage;
