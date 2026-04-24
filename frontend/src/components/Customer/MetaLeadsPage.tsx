import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FaFacebook, FaEnvelope, FaPhone, FaCalendar, FaCheckCircle, FaTimesCircle, FaClock, FaUser, FaMapMarkerAlt, FaCalendarCheck, FaSpinner, FaFilter, FaSyncAlt } from 'react-icons/fa';
import { startOfMonth, endOfMonth, subMonths, format, startOfDay, endOfDay, subDays } from 'date-fns';
import DatePicker from 'react-multi-date-picker';

interface MetaLead {
  _id: string;
  emailSubject: string;
  campaignName?: string | null;
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

interface LeadDraft {
  statusUpdate: 'contacted' | 'not_contacted' | null;
  notContactedReason: string;
  appointmentBooked: boolean | null;
  appointmentReason: string;
}

const MetaLeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<MetaLead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [leadDrafts, setLeadDrafts] = useState<Record<string, LeadDraft>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const leadsRequestSeqRef = useRef(0);
  const statsRequestSeqRef = useRef(0);

  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, [startDate, endDate, selectedStatus]);

  // Auto-refresh every minute so imported or newly ingested leads appear without manual refresh.
  useEffect(() => {
    const intervalMs = 60 * 1000;
    const interval = setInterval(() => {
      fetchLeads(true);
      fetchStats();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [startDate, endDate, selectedStatus]);

  useEffect(() => {
    const refreshVisiblePage = () => {
      fetchLeads(true);
      fetchStats();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshVisiblePage();
      }
    };

    window.addEventListener('focus', refreshVisiblePage);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', refreshVisiblePage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [startDate, endDate, selectedStatus]);

  const fetchLeads = async (silent = false) => {
    const requestSeq = ++leadsRequestSeqRef.current;
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
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

      if (requestSeq === leadsRequestSeqRef.current) {
        setLeads(response.data.leads || []);
      }
    } catch (err: any) {
      console.error('Error fetching leads:', err);
      if (!silent && requestSeq === leadsRequestSeqRef.current) {
        setError(err.response?.data?.message || 'Failed to fetch leads');
      }
    } finally {
      if (!silent && requestSeq === leadsRequestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  const fetchStats = async () => {
    const requestSeq = ++statsRequestSeqRef.current;
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

      if (requestSeq === statsRequestSeqRef.current) {
        setStats(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching lead stats:', err);
    }
  };


  const getLeadDraft = (lead: MetaLead): LeadDraft => {
    const existingDraft = leadDrafts[lead._id];
    if (existingDraft) return existingDraft;

    return {
      statusUpdate:
        lead.status === 'contacted'
          ? 'contacted'
          : lead.status === 'not_contacted'
            ? 'not_contacted'
            : null,
      notContactedReason: lead.notContactedReason || '',
      appointmentBooked: lead.appointmentBooked ?? null,
      appointmentReason: lead.appointmentBookingReason || '',
    };
  };

  const updateLeadDraft = (leadId: string, patch: Partial<LeadDraft>) => {
    setLeadDrafts((current) => ({
      ...current,
      [leadId]: {
        ...(current[leadId] || {
          statusUpdate: null,
          notContactedReason: '',
          appointmentBooked: null,
          appointmentReason: '',
        }),
        ...patch,
      },
    }));
  };

  const patchLeadStatus = async (leadId: string, status: 'contacted' | 'not_contacted', reason?: string) => {
    const token = localStorage.getItem('customerToken');
    if (!token) return;

    if (status === 'not_contacted' && !reason?.trim()) {
      throw new Error('A reason is required for not contacting a lead');
    }

    await axios.patch(
      `${import.meta.env.VITE_API_BASE_URL}/meta-leads/customer/leads/${leadId}/status`,
      { status, reason: status === 'not_contacted' ? reason : undefined },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  };

  const patchLeadAppointment = async (leadId: string, appointmentBooked: boolean | null, appointmentReason: string) => {
    const token = localStorage.getItem('customerToken');
    if (!token) return;

    if (appointmentBooked === null || appointmentBooked === undefined) {
      throw new Error('Please select whether an appointment was booked');
    }

    if (appointmentBooked === false && !appointmentReason.trim()) {
      throw new Error('Please provide a reason why the appointment was not booked');
    }

    await axios.patch(
      `${import.meta.env.VITE_API_BASE_URL}/meta-leads/customer/leads/${leadId}/appointment`,
      {
        appointmentBooked,
        reason: appointmentReason
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  };

  const handleStatusUpdate = async (leadId: string, status: 'contacted' | 'not_contacted', reason?: string) => {
    try {
      await patchLeadStatus(leadId, status, reason);

      const existingDraft = leadDrafts[leadId];
      updateLeadDraft(leadId, {
        statusUpdate: status,
        notContactedReason: status === 'not_contacted' ? (reason || '') : '',
        appointmentBooked: status === 'contacted' ? (existingDraft?.appointmentBooked ?? null) : null,
        appointmentReason: status === 'contacted' ? (existingDraft?.appointmentReason ?? '') : '',
      });

      fetchLeads();
      fetchStats();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      alert(error.response?.data?.message || error.message || 'Failed to update status');
    }
  };

  const handleAppointmentUpdate = async (leadId: string, appointmentBooked: boolean | null, appointmentReason: string) => {
    try {
      await patchLeadAppointment(leadId, appointmentBooked, appointmentReason);
      updateLeadDraft(leadId, { appointmentBooked, appointmentReason });
      fetchLeads();
      fetchStats();
    } catch (error: any) {
      console.error('Failed to update appointment:', error);
      alert(error.response?.data?.message || error.message || 'Failed to update appointment status');
    }
  };

  const handleLeadWorkflowSave = async (lead: MetaLead) => {
    const draft = getLeadDraft(lead);

    if (!draft.statusUpdate) {
      alert('Please answer "Did you contact them?" first');
      return;
    }

    try {
      if (draft.statusUpdate === 'not_contacted') {
        await patchLeadStatus(lead._id, 'not_contacted', draft.notContactedReason);
      } else {
        if (lead.status !== 'contacted') {
          await patchLeadStatus(lead._id, 'contacted');
        }

        if (draft.appointmentBooked !== null) {
          await patchLeadAppointment(lead._id, draft.appointmentBooked, draft.appointmentReason);
        }
      }

      setLeadDrafts((current) => ({
        ...current,
        [lead._id]: {
          statusUpdate: draft.statusUpdate,
          notContactedReason: draft.statusUpdate === 'not_contacted' ? draft.notContactedReason : '',
          appointmentBooked: draft.statusUpdate === 'contacted' ? draft.appointmentBooked : null,
          appointmentReason: draft.statusUpdate === 'contacted' ? draft.appointmentReason : '',
        },
      }));

      fetchLeads();
      fetchStats();
    } catch (error: any) {
      console.error('Failed to save lead workflow:', error);
      alert(error.response?.data?.message || error.message || 'Failed to save lead update');
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
      if (tempStartDate.getTime() > tempEndDate.getTime()) {
        setError('Invalid date range: start date must be before end date.');
        return;
      }
      setError(null);
      // Ensure dates are at start and end of day for proper filtering
      setStartDate(startOfDay(tempStartDate));
      setEndDate(endOfDay(tempEndDate));
      setTempStartDate(null);
      setTempEndDate(null);
      setActiveFilter('custom');
    } else if (tempStartDate) {
      setError(null);
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

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-screen">
        <FaSpinner className="animate-spin text-3xl text-blue-500" />
      </div>
    );
  }

  return (
    <div className="customer-page metaleads-page p-4 sm:p-6 md:p-8 min-h-screen overflow-x-hidden">
      <div className="w-full mx-auto max-w-full xl:max-w-7xl 2xl:max-w-7xl">
        {/* Header */}
        <div className="cm-page-hero mb-4 px-5 py-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FaFacebook className="text-blue-500" />
              Meta Leads
            </h1>
            <p className="text-sm text-gray-600 mt-1">When a lead email arrives in your clinic&apos;s mapped Meta Leads folder, it is added to the portal automatically. This page refreshes every minute so you see new and updated leads quickly. Use Refresh to sync your mapped folder(s) now.</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setRefreshing(true);
              setSyncMessage(null);
              const token = localStorage.getItem('customerToken');
              try {
                if (token) {
                  const syncRes = await axios.post(
                    `${import.meta.env.VITE_API_BASE_URL}/meta-leads/customer/sync-emails`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                  );
                  const result = syncRes.data?.result || {};
                  const created = result.leadsCreatedForCustomer ?? result.leadsCreated ?? 0;
                  const updated = result.leadsUpdated ?? 0;
                  const found = result.emailsFound ?? 0;
                  const daysBackUsed = result.daysBackUsed;
                  if (result.skipped) {
                    setSyncMessage({ type: 'info', text: 'Sync skipped (already in progress). Try again in a moment.' });
                  } else if (result.errors?.length) {
                    setSyncMessage({ type: 'info', text: `Sync completed. ${found} email(s) checked. ${result.errors.join(' ')}` });
                  } else if (created > 0 || updated > 0) {
                    const parts = [];
                    if (created > 0) parts.push(`${created} new lead(s) added`);
                    if (updated > 0) parts.push(`${updated} existing lead(s) updated`);
                    setSyncMessage({ type: 'success', text: `Synced. ${parts.join(' and ')} for your clinic${daysBackUsed ? ` (checked last ${daysBackUsed} day(s))` : ''}.` });
                  } else {
                    setSyncMessage({ type: 'success', text: `Synced. ${found} email(s) checked${daysBackUsed ? ` (last ${daysBackUsed} day(s))` : ''}. No new leads for your clinic.` });
                  }
                }
                await Promise.all([fetchLeads(true), fetchStats()]);
              } catch (err: any) {
                const msg = err.response?.data?.message || err.response?.data?.error || 'Sync failed.';
                setSyncMessage({ type: 'error', text: msg });
              } finally {
                setRefreshing(false);
                setTimeout(() => setSyncMessage((m) => (m?.type === 'error' ? m : null)), 6000);
              }
            }}
            disabled={refreshing}
            title="Connect to the leads inbox, sync your clinic's mapped Meta Leads folder(s), then refresh the list."
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-semibold text-sm shadow transition-colors"
          >
            {refreshing ? <FaSpinner className="animate-spin" /> : <FaSyncAlt />}
            {refreshing ? 'Syncing & refreshing...' : 'Refresh leads'}
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="cm-panel p-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Leads</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.totalLeads ?? 0}</p>
          </div>
          <div className="cm-panel p-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Contacted</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.contactedLeads ?? 0}</p>
          </div>
          <div className="cm-panel p-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Appointments</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.bookedAppointments ?? 0}</p>
          </div>
          <div className="cm-panel p-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Conversion</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats?.totalLeads ? `${Math.round(((stats.bookedAppointments || 0) / stats.totalLeads) * 100)}%` : '0%'}
            </p>
          </div>
        </div>

        {/* Sync result message */}
        {syncMessage && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg border ${
              syncMessage.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : syncMessage.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            {syncMessage.text}
            {syncMessage.type === 'error' && (
              <button
                type="button"
                onClick={() => setSyncMessage(null)}
                className="ml-2 underline"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Date Filters */}
        <div className="cm-panel mb-4 p-4">
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
              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Total Leads</p>
                    <p className="text-xl font-bold text-gray-800">{stats.totalLeads}</p>
                  </div>
                  <FaFacebook className="text-gray-400 text-xl" />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Contacted</p>
                    <p className="text-xl font-bold text-gray-800">{stats.contactedLeads}</p>
                  </div>
                  <FaCheckCircle className="text-gray-400 text-xl" />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Not Contacted</p>
                    <p className="text-xl font-bold text-gray-800">{stats.totalLeads - stats.contactedLeads}</p>
                  </div>
                  <FaTimesCircle className="text-gray-400 text-xl" />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-600">Appointments</p>
                    <p className="text-xl font-bold text-gray-800">{stats.bookedAppointments || 0}</p>
                  </div>
                  <FaCalendarCheck className="text-gray-400 text-xl" />
                </div>
              </div>
            </div>

            {/* Conversion Rate */}
            {stats && stats.totalLeads > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 font-medium">Contact Rate</p>
                      <p className="mt-1 text-xl font-bold text-gray-800">
                        {Math.round((stats.contactedLeads / stats.totalLeads) * 100)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {stats.contactedLeads} of {stats.totalLeads} leads contacted
                      </p>
                    </div>
                    <FaCheckCircle className="text-gray-400 text-xl" />
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-600 font-medium">Conversion Rate</p>
                      <p className="mt-1 text-xl font-bold text-gray-800">
                        {Math.round((stats.bookedAppointments / stats.totalLeads) * 100)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {stats.bookedAppointments} of {stats.totalLeads} leads booked
                      </p>
                    </div>
                    <FaCalendarCheck className="text-gray-400 text-xl" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Leads Table */}
        <div className="cm-panel overflow-hidden">
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
            <>
              {false && (
              <div className="p-4 space-y-4">
                {leads.map((lead) => {
                  const draft = getLeadDraft(lead);
                  const showAppointmentQuestion = draft.statusUpdate === 'contacted';
                  const savedContacted = lead.status === 'contacted';

                  return (
                    <div key={lead._id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-start gap-3">
                            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                              <div className="flex items-center gap-1 text-xs font-semibold text-blue-800">
                                <FaCalendar className="text-blue-500" />
                                Received
                              </div>
                              <div className="mt-1 text-xs font-mono text-blue-700">{formatDate(lead.emailDate)}</div>
                            </div>

                            <div className="min-w-0 flex-1">
                              {(() => {
                                const personName = typeof lead.leadInfo?.name === 'string' ? lead.leadInfo.name.trim() : '';
                                const campaignName = typeof lead.campaignName === 'string'
                                  ? lead.campaignName.trim()
                                  : (typeof lead.leadInfo?.fields?.['campaign name'] === 'string' ? lead.leadInfo.fields['campaign name'].trim() : '');
                                const displayName = personName || campaignName;
                                return displayName ? (
                                  <div className="flex items-center gap-2">
                                    <FaUser className="text-gray-400 shrink-0" />
                                    <span className="text-lg font-bold text-gray-900 break-words">{displayName}</span>
                                  </div>
                                ) : (
                                  <div className="text-sm italic text-gray-400">No name</div>
                                );
                              })()}

                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                <div className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                                  <FaPhone className="text-gray-400 shrink-0" />
                                  <span className="break-all">{lead.leadInfo?.phone || 'No phone'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-700 min-w-0">
                                  <FaEnvelope className="text-gray-400 shrink-0" />
                                  <span className="break-all">{lead.leadInfo?.email || 'No email'}</span>
                                </div>
                              </div>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {lead.leadInfo?.fields?.city && (
                                  <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                                    <FaMapMarkerAlt className="text-gray-400" />
                                    <span>{lead.leadInfo.fields.city}</span>
                                  </div>
                                )}
                                {(() => {
                                  const campaign = lead.campaignName ?? lead.leadInfo?.fields?.['campaign name'];
                                  const hasCampaign = typeof campaign === 'string' && campaign.trim() !== '';
                                  return hasCampaign ? (
                                    <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                                      Campaign: {campaign.trim()}
                                    </div>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                {getStatusIcon(lead.status)}
                                <span>{getStatusLabel(lead.status)}</span>
                              </div>
                              {lead.contactedAt && (
                                <p className="mt-2 text-xs text-green-700">Contacted: {formatDate(lead.contactedAt)}</p>
                              )}
                              {lead.notContactedAt && (
                                <p className="mt-2 text-xs text-red-700">Not contacted: {formatDate(lead.notContactedAt)}</p>
                              )}
                              {lead.notContactedReason && (
                                <p className="mt-2 text-xs italic text-red-600 break-words">{lead.notContactedReason}</p>
                              )}
                            </div>

                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                <FaCalendarCheck className="text-purple-500" />
                                <span>
                                  {lead.appointmentBooked === true
                                    ? 'Appointment booked'
                                    : lead.appointmentBooked === false
                                      ? 'No appointment booked'
                                      : 'Appointment not set'}
                                </span>
                              </div>
                              {lead.appointmentBookedAt && (
                                <p className="mt-2 text-xs text-purple-700">Booked: {formatDate(lead.appointmentBookedAt)}</p>
                              )}
                              {lead.appointmentBookingReason && (
                                <p className="mt-2 text-xs italic text-orange-700 break-words">{lead.appointmentBookingReason}</p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="w-full xl:w-[320px] shrink-0">
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                            <div>
                              <p className="text-sm font-bold text-gray-900 mb-3">Did you contact them?</p>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => updateLeadDraft(lead._id, { statusUpdate: 'contacted' })}
                                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                    draft.statusUpdate === 'contacted'
                                      ? 'border-green-500 bg-green-100 text-green-900'
                                      : 'border-gray-300 bg-white text-gray-700 hover:border-green-300'
                                  }`}
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateLeadDraft(lead._id, { statusUpdate: 'not_contacted', appointmentBooked: null, appointmentReason: '' })}
                                  className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                    draft.statusUpdate === 'not_contacted'
                                      ? 'border-red-500 bg-red-100 text-red-900'
                                      : 'border-gray-300 bg-white text-gray-700 hover:border-red-300'
                                  }`}
                                >
                                  No
                                </button>
                              </div>
                              {draft.statusUpdate !== null && lead.status !== draft.statusUpdate && (
                                <p className="mt-2 text-xs text-amber-600">Unsaved change.</p>
                              )}
                            </div>

                            {draft.statusUpdate === 'not_contacted' && (
                              <div className="space-y-2">
                                <label className="block text-sm font-bold text-gray-900">Why not?</label>
                                <textarea
                                  value={draft.notContactedReason}
                                  onChange={(e) => updateLeadDraft(lead._id, { notContactedReason: e.target.value })}
                                  placeholder="Tell us why this lead was not contacted..."
                                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                                  rows={3}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleStatusUpdate(lead._id, 'not_contacted', draft.notContactedReason)}
                                  className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                                >
                                  Save
                                </button>
                              </div>
                            )}

                            {showAppointmentQuestion && (
                              <div className="space-y-3 border-t border-gray-200 pt-4">
                                <button
                                  type="button"
                                  onClick={() => handleStatusUpdate(lead._id, 'contacted')}
                                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                  {savedContacted ? 'Keep as Contacted' : 'Save Contacted'}
                                </button>

                                {savedContacted && (
                                  <>
                                    <div>
                                      <p className="text-sm font-bold text-gray-900 mb-3">Did you book an appointment?</p>
                                      <div className="grid grid-cols-2 gap-2">
                                        <button
                                          type="button"
                                          onClick={() => updateLeadDraft(lead._id, { appointmentBooked: true, appointmentReason: '' })}
                                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                            draft.appointmentBooked === true
                                              ? 'border-purple-500 bg-purple-100 text-purple-900'
                                              : 'border-gray-300 bg-white text-gray-700 hover:border-purple-300'
                                          }`}
                                        >
                                          Yes
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => updateLeadDraft(lead._id, { appointmentBooked: false })}
                                          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                            draft.appointmentBooked === false
                                              ? 'border-orange-500 bg-orange-100 text-orange-900'
                                              : 'border-gray-300 bg-white text-gray-700 hover:border-orange-300'
                                          }`}
                                        >
                                          No
                                        </button>
                                      </div>
                                    </div>

                                    {draft.appointmentBooked === false && (
                                      <div className="space-y-2">
                                        <label className="block text-sm font-bold text-gray-900">Why not?</label>
                                        <textarea
                                          value={draft.appointmentReason}
                                          onChange={(e) => updateLeadDraft(lead._id, { appointmentReason: e.target.value })}
                                          placeholder="Tell us why no appointment was booked..."
                                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                                          rows={3}
                                        />
                                      </div>
                                    )}

                                    {draft.appointmentBooked === true && (
                                      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                                        <p className="text-sm font-semibold text-green-800">Good.</p>
                                      </div>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => handleAppointmentUpdate(lead._id, draft.appointmentBooked, draft.appointmentReason)}
                                      className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                                    >
                                      Save Appointment
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
              <div className="overflow-x-auto">
              <table className="w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Received
                    </th>
                    <th className="w-[30%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Lead Info
                    </th>
                    <th className="w-[12%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Campaign
                    </th>
                    <th className="w-[18%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status & Timestamps
                    </th>
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Appointment
                    </th>
                    <th className="w-[16%] px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Follow Up
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leads.map((lead) => {
                    const draft = getLeadDraft(lead);
                    const showAppointmentQuestion = draft.statusUpdate === 'contacted';
                    const hasUnsavedStatusChange = draft.statusUpdate !== null && draft.statusUpdate !== lead.status;
                    const hasUnsavedAppointmentChange =
                      lead.status === 'contacted' &&
                      draft.appointmentBooked !== null &&
                      (
                        draft.appointmentBooked !== (lead.appointmentBooked ?? null) ||
                        (draft.appointmentBooked === false && draft.appointmentReason !== (lead.appointmentBookingReason || ''))
                      );
                    const needsSave = hasUnsavedStatusChange || hasUnsavedAppointmentChange;

                    return (
                    <tr key={lead._id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center">
                            <FaCalendar className="text-gray-400 mr-1.5 text-xs" />
                            <span className="text-xs text-gray-900 font-semibold">Received:</span>
                          </div>
                          <div className="rounded border border-gray-200 bg-gray-50 p-2">
                            <div className="mb-0.5 text-xs font-medium text-gray-700">Date & Time</div>
                            <div className="text-xs font-mono text-gray-700">{formatDate(lead.emailDate)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col space-y-2">
                          {(() => {
                            const personName = typeof lead.leadInfo?.name === 'string' ? lead.leadInfo.name.trim() : '';
                            const campaignName = typeof lead.campaignName === 'string'
                              ? lead.campaignName.trim()
                              : (typeof lead.leadInfo?.fields?.['campaign name'] === 'string' ? lead.leadInfo.fields['campaign name'].trim() : '');
                            const displayName = personName || campaignName;
                            return displayName ? (
                              <div>
                                <div className="flex items-center">
                                  <FaUser className="text-gray-400 mr-2 text-sm" />
                                  <span className="text-sm text-gray-900 font-semibold">{displayName}</span>
                                </div>
                                {campaignName && personName && (
                                  <p className="mt-1 break-words pl-6 text-xs text-gray-500">{campaignName}</p>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <FaUser className="text-gray-300 mr-2 text-sm" />
                                <span className="text-sm text-gray-400 italic">No name</span>
                              </div>
                            );
                          })()}
                          {lead.leadInfo?.phone ? (
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
                          {lead.leadInfo?.email ? (
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
                          {lead.leadInfo?.fields?.city && (
                            <div className="flex items-center mt-1">
                              <FaMapMarkerAlt className="text-gray-400 mr-2 text-sm" />
                              <span className="text-sm text-gray-600">{lead.leadInfo.fields.city}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="max-w-[180px]">
                          {(() => {
                            const campaign = lead.campaignName ?? lead.leadInfo?.fields?.['campaign name'];
                            const hasCampaign = typeof campaign === 'string' && campaign.trim() !== '';
                            return hasCampaign ? (
                              <span className="text-xs text-gray-700 break-words" title={campaign.trim()}>
                                {campaign.trim()}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">—</span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col space-y-1.5">
                          <div className="flex items-center">
                            <span className="text-xs">{getStatusIcon(lead.status)}</span>
                            <span className="text-xs text-gray-900 font-medium ml-1.5">{getStatusLabel(lead.status)}</span>
                          </div>
                          {lead.contactedAt && (
                            <div className="rounded border border-gray-200 bg-gray-50 p-2">
                              <div className="mb-0.5 text-xs font-medium text-gray-700">Contacted At:</div>
                              <div className="text-xs text-gray-700">{formatDate(lead.contactedAt)}</div>
                            </div>
                          )}
                          {lead.notContactedAt && (
                            <div className="rounded border border-gray-200 bg-gray-50 p-2">
                              <div className="mb-0.5 text-xs font-medium text-gray-700">Not Contacted At:</div>
                              <div className="mb-1 text-xs text-gray-700">{formatDate(lead.notContactedAt)}</div>
                              {lead.notContactedReason && (
                                <div className="mt-1 border-t border-gray-200 pt-1 text-xs italic text-gray-600">
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
                            <div className="rounded border border-gray-200 bg-gray-50 p-2">
                              <div className="mb-1 flex items-center">
                                <FaCalendarCheck className="mr-1 text-xs text-gray-500" />
                                <span className="text-xs font-semibold text-gray-800">Booked</span>
                              </div>
                              {lead.appointmentBookedAt && (
                                <div className="mb-1 text-xs text-gray-700">
                                  Booked At: {formatDate(lead.appointmentBookedAt)}
                                </div>
                              )}
                              {lead.appointmentBookingReason && (
                                <div className="mt-1 border-t border-gray-200 pt-1 text-xs italic text-gray-600">
                                  {lead.appointmentBookingReason.length > 80 ? `${lead.appointmentBookingReason.substring(0, 80)}...` : lead.appointmentBookingReason}
                                </div>
                              )}
                            </div>
                          ) : lead.appointmentBooked === false ? (
                            <div className="rounded border border-gray-200 bg-gray-50 p-2">
                              <div className="mb-1 text-xs font-semibold text-gray-800">Not Booked</div>
                              {lead.appointmentBookingReason && (
                                <div className="text-xs italic text-gray-600">
                                  {lead.appointmentBookingReason.length > 80 ? `${lead.appointmentBookingReason.substring(0, 80)}...` : lead.appointmentBookingReason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 italic">Not Set</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 min-w-[320px]">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                          <div>
                            <p className="text-sm font-bold text-gray-900 mb-3">Did you contact them?</p>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => updateLeadDraft(lead._id, { statusUpdate: 'contacted' })}
                                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                  draft.statusUpdate === 'contacted'
                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                }`}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => updateLeadDraft(lead._id, { statusUpdate: 'not_contacted', appointmentBooked: null, appointmentReason: '' })}
                                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                  draft.statusUpdate === 'not_contacted'
                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                }`}
                              >
                                No
                              </button>
                            </div>
                            {hasUnsavedStatusChange && (
                              <p className="text-xs text-amber-600 mt-2">Unsaved change.</p>
                            )}
                          </div>

                          {draft.statusUpdate === 'not_contacted' && (
                            <div className="space-y-2">
                              <label className="block text-sm font-bold text-gray-900">Why not?</label>
                              <textarea
                                value={draft.notContactedReason}
                                onChange={(e) => updateLeadDraft(lead._id, { notContactedReason: e.target.value })}
                                placeholder="Tell us why this lead was not contacted..."
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                                rows={3}
                              />
                            </div>
                          )}

                          {showAppointmentQuestion && (
                            <div className="space-y-3 border-t border-gray-200 pt-4">
                              <div>
                                <p className="text-sm font-bold text-gray-900 mb-3">Did you book an appointment?</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updateLeadDraft(lead._id, { appointmentBooked: true, appointmentReason: '' })}
                                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                      draft.appointmentBooked === true
                                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                    }`}
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateLeadDraft(lead._id, { appointmentBooked: false })}
                                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                                      draft.appointmentBooked === false
                                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                                    }`}
                                  >
                                    No
                                  </button>
                                </div>
                              </div>

                              {draft.appointmentBooked === false && (
                                <div className="space-y-2">
                                  <label className="block text-sm font-bold text-gray-900">Why not?</label>
                                  <textarea
                                    value={draft.appointmentReason}
                                    onChange={(e) => updateLeadDraft(lead._id, { appointmentReason: e.target.value })}
                                    placeholder="Tell us why no appointment was booked..."
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                                    rows={3}
                                  />
                                </div>
                              )}

                              {draft.appointmentBooked === true && (
                                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                                  <p className="text-sm font-semibold text-gray-700">&nbsp;</p>
                                </div>
                              )}

                              {needsSave && <p className="text-xs text-amber-600">Unsaved change.</p>}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleLeadWorkflowSave(lead)}
                            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            {draft.statusUpdate === 'contacted' && draft.appointmentBooked !== null
                              ? 'Save update'
                              : draft.statusUpdate === 'not_contacted'
                                ? 'Save status'
                                : 'Save contact status'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetaLeadsPage;







