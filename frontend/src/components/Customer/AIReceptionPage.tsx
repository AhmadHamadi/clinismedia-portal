import React, { useEffect, useMemo, useState } from 'react';
import { FaClock, FaRobot, FaSpinner, FaTimesCircle } from 'react-icons/fa';
import axios from 'axios';

const API = import.meta.env.VITE_API_BASE_URL;

interface RetellCall {
  retellCallId: string;
  twilioCallSid?: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  callStatus: string | null;
  disconnectionReason: string | null;
  startTimestamp: string | null;
  endTimestamp: string | null;
  durationMs: number | null;
  recordingUrl: string | null;
  transcript: string | null;
  callAnalysis?: {
    callSummary?: string | null;
    callSuccessful?: boolean | null;
    callerName?: string | null;
    callbackNumber?: string | null;
    email?: string | null;
    userSentiment?: string | null;
    urgencyLevel?: string | null;
    patientType?: string | null;
    reasonForCall?: string | null;
    symptomsMentioned?: string | null;
    locationWorksForCaller?: string | null;
    preferredCallbackTime?: string | null;
    recommendedFollowUp?: string | null;
    serviceRequested?: string | null;
    appointmentIntent?: boolean | null;
    insuranceMentioned?: boolean | null;
    insuranceProvider?: string | null;
    painLevel?: string | number | null;
    preferredLocation?: string | null;
    bestNextAction?: string | null;
    bookingReadiness?: string | null;
  };
}

const formatDuration = (durationMs: number | null) => {
  if (!durationMs || durationMs <= 0) return '0m';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString();
};

const formatLabel = (value?: string | null) => {
  if (!value) return 'n/a';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getCallerName = (call: RetellCall) =>
  call.callAnalysis?.callerName ||
  call.callAnalysis?.callbackNumber ||
  call.fromNumber ||
  'Unknown caller';

const getCallSummary = (call: RetellCall) =>
  call.callAnalysis?.callSummary ||
  call.callAnalysis?.reasonForCall ||
  'AI receptionist handled this call. Open to view the handoff details.';

type TimeRange = 'all' | 'today' | '7d' | '30d';

const isWithinRange = (call: RetellCall, range: TimeRange) => {
  if (range === 'all') return true;
  if (!call.startTimestamp) return false;

  const now = new Date();
  const callTime = new Date(call.startTimestamp);
  const diffMs = now.getTime() - callTime.getTime();

  if (range === 'today') {
    return callTime.toDateString() === now.toDateString();
  }
  if (range === '7d') {
    return diffMs <= 7 * 24 * 60 * 60 * 1000;
  }
  return diffMs <= 30 * 24 * 60 * 60 * 1000;
};

const getGroupLabel = (value: string | null) => {
  if (!value) return 'Older Calls';
  const now = new Date();
  const date = new Date(value);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));

  if (date.toDateString() === now.toDateString()) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  if (diffDays <= 7) return 'This Week';
  if (now.getMonth() === date.getMonth() && now.getFullYear() === date.getFullYear()) return 'This Month';
  return 'Older Calls';
};

const AIReceptionPage: React.FC = () => {
  const [calls, setCalls] = useState<RetellCall[]>([]);
  const [selectedCall, setSelectedCall] = useState<RetellCall | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('customerToken');
        if (!token) {
          setError('Not authenticated.');
          setIsLoading(false);
          return;
        }

        const callsRes = await axios.get(`${API}/retell/calls?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const nextCalls = callsRes.data?.calls ?? [];
        setCalls(nextCalls);
        setSelectedCall(nextCalls[0] ?? null);

        try {
          await axios.post(`${API}/customer-notifications/mark-read/aiReception`, {}, {
            headers: { Authorization: `Bearer ${token}` },
          });
          window.dispatchEvent(new CustomEvent('refreshCustomerNotifications'));
        } catch (markReadError) {
          console.error('Failed to mark AI reception notifications as read:', markReadError);
        }
      } catch (err: any) {
        setError(err.response?.data?.error ?? 'Failed to load AI receptionist calls.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const summaryStats = useMemo(() => {
    const urgentCount = calls.filter((call) => ['high', 'emergency'].includes(call.callAnalysis?.urgencyLevel || '')).length;
    const callbackCount = calls.filter((call) => !!call.callAnalysis?.callbackNumber || !!call.fromNumber).length;
    return {
      total: calls.length,
      urgent: urgentCount,
      callbacks: callbackCount,
    };
  }, [calls]);

  const filteredCalls = useMemo(
    () => calls.filter((call) => isWithinRange(call, timeRange)),
    [calls, timeRange]
  );

  const groupedCalls = useMemo(() => {
    const groups: Record<string, RetellCall[]> = {};
    for (const call of filteredCalls) {
      const label = getGroupLabel(call.startTimestamp);
      groups[label] = groups[label] || [];
      groups[label].push(call);
    }

    const orderedLabels = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older Calls'];
    return orderedLabels
      .filter((label) => groups[label]?.length)
      .map((label) => ({ label, calls: groups[label] }));
  }, [filteredCalls]);

  useEffect(() => {
    if (!selectedCall) {
      setSelectedCall(filteredCalls[0] ?? null);
      return;
    }

    const stillVisible = filteredCalls.find((call) => call.retellCallId === selectedCall.retellCallId);
    if (!stillVisible) {
      setSelectedCall(filteredCalls[0] ?? null);
    }
  }, [filteredCalls, selectedCall]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <FaRobot className="text-2xl text-blue-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI Receptionist</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              A simple after-hours handoff for your team: who called, when they called, and what needs follow-up.
            </p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-12 shadow-sm">
          <FaSpinner className="animate-spin text-2xl text-blue-400" />
        </div>
      )}

      {error && !isLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FaTimesCircle /> {error}
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recent AI Calls</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{summaryStats.total}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Urgent Follow-Ups</p>
              <p className="mt-2 text-2xl font-bold text-red-600">{summaryStats.urgent}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Callback Numbers Captured</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{summaryStats.callbacks}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Recent Calls</h2>
                  <p className="mt-1 text-xs text-gray-400">{filteredCalls.length} shown</p>
                </div>
                <select
                  value={timeRange}
                  onChange={(event) => setTimeRange(event.target.value as TimeRange)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700"
                >
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="all">All time</option>
                </select>
              </div>

              {filteredCalls.length === 0 ? (
                <p className="text-sm text-gray-500">No after-hours AI calls were found for this time range.</p>
              ) : (
                <div className="space-y-4">
                  {groupedCalls.map((group) => (
                    <div key={group.label}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{group.label}</p>
                      <div className="space-y-3">
                        {group.calls.map((call) => {
                          const active = selectedCall?.retellCallId === call.retellCallId;
                          return (
                            <div
                              key={call.retellCallId}
                              className={`rounded-lg border px-4 py-3 transition ${
                                active
                                  ? 'border-blue-300 bg-blue-50'
                                  : 'border-gray-200 bg-gray-50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-gray-900">{getCallerName(call)}</p>
                                  <p className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                                    <FaClock className="text-[10px]" />
                                    {formatDateTime(call.startTimestamp)}
                                  </p>
                                </div>
                                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-gray-600">
                                  {formatDuration(call.durationMs)}
                                </span>
                              </div>
                              <div className="mt-2 space-y-1 text-sm text-gray-600">
                                <p className="line-clamp-2">{getCallSummary(call)}</p>
                                <p>
                                  <span className="font-medium text-gray-700">Reason:</span>{' '}
                                  {call.callAnalysis?.reasonForCall || call.callAnalysis?.serviceRequested || 'Not captured'}
                                </p>
                                <p>
                                  <span className="font-medium text-gray-700">Urgency:</span>{' '}
                                  {formatLabel(call.callAnalysis?.urgencyLevel)}
                                </p>
                              </div>
                              <button
                                onClick={() => setSelectedCall(call)}
                                className="mt-3 text-xs font-semibold uppercase tracking-wide text-blue-600 hover:text-blue-800"
                              >
                                Click to see more details
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              {!selectedCall ? (
                <p className="text-sm text-gray-500">Select a call to see the handoff details.</p>
              ) : (
                <div className="space-y-4">
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-lg font-bold text-gray-900">{getCallerName(selectedCall)}</h2>
                    <p className="mt-1 text-sm text-gray-500">{formatDateTime(selectedCall.startTimestamp)}</p>
                    <div className="mt-3 rounded-lg bg-blue-50 px-4 py-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-500">What Happened</p>
                      <p className="text-sm text-blue-950">{getCallSummary(selectedCall)}</p>
                    </div>
                  </div>

                  {selectedCall.recordingUrl && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Recording</p>
                      <audio controls className="w-full" src={selectedCall.recordingUrl} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIReceptionPage;
