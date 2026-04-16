import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaClock, FaPhone, FaRobot, FaSpinner, FaTimesCircle } from 'react-icons/fa';
import axios from 'axios';

const API = import.meta.env.VITE_API_BASE_URL;

interface BusinessHoursDay {
  enabled: boolean;
  start: string;
  end: string;
}

interface AIConfig {
  clinicName: string;
  twilioPhoneNumber: string | null;
  aiReceptionistSettings: {
    enabled: boolean;
    routingMode: 'off' | 'after_hours' | 'always_ai';
    telephonyMode: string;
    retellAgentId: string | null;
    timezone: string;
    sendMissedCallsToAi: boolean;
    afterHoursMessage: string | null;
    businessHours: Record<string, BusinessHoursDay>;
  };
  routingSummary: {
    enabled: boolean;
    routingMode: string;
    destination: string;
  };
}

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

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const ROUTING_LABELS: Record<string, string> = {
  off: 'Off',
  after_hours: 'After Hours',
  always_ai: 'Always Active',
};

const formatDuration = (durationMs: number | null) => {
  if (!durationMs || durationMs <= 0) {
    return '0m';
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString();
};

const formatSentiment = (value?: string | null) => {
  if (!value) return 'n/a';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const formatBoolean = (value?: boolean | null) => {
  if (value == null) return 'n/a';
  return value ? 'Yes' : 'No';
};

const AIReceptionPage: React.FC = () => {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [calls, setCalls] = useState<RetellCall[]>([]);
  const [selectedCall, setSelectedCall] = useState<RetellCall | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('customerToken');
        if (!token) {
          setError('Not authenticated.');
          setIsLoading(false);
          return;
        }

        const [configRes, callsRes] = await Promise.all([
          axios.get(`${API}/retell/configuration`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API}/retell/calls?limit=10`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setConfig(configRes.data);
        setCalls(callsRes.data?.calls ?? []);

        try {
          await axios.post(`${API}/customer-notifications/mark-read/aiReception`, {}, {
            headers: { Authorization: `Bearer ${token}` },
          });
          window.dispatchEvent(new CustomEvent('refreshCustomerNotifications'));
        } catch (markReadError) {
          console.error('Failed to mark AI reception notifications as read:', markReadError);
        }
      } catch (err: any) {
        setError(err.response?.data?.error ?? 'Failed to load AI reception configuration.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const settings = config?.aiReceptionistSettings;
  const openDays = settings ? DAY_ORDER.filter((day) => settings.businessHours[day]?.enabled) : [];
  const closedDays = settings ? DAY_ORDER.filter((day) => !settings.businessHours[day]?.enabled) : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <FaRobot className="text-2xl text-blue-500" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI Receptionist</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Your after-hours AI reception status, routing settings, and recent AI-handled calls.
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

      {config && settings && !isLoading && (
        <>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Status</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full ${settings.enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {settings.enabled ? <FaCheckCircle className="text-green-500" /> : <FaTimesCircle className="text-gray-400" />}
                </div>
                <div>
                  <p className="text-xs text-gray-500">AI Status</p>
                  <p className={`text-sm font-semibold ${settings.enabled ? 'text-green-700' : 'text-gray-500'}`}>
                    {settings.enabled ? 'Active' : 'Inactive'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
                  <FaPhone className="text-sm text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Routing Mode</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {ROUTING_LABELS[settings.routingMode] ?? settings.routingMode}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100">
                  <FaClock className="text-sm text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Timezone</p>
                  <p className="text-sm font-semibold text-gray-700">{settings.timezone.replace('America/', '')}</p>
                </div>
              </div>
            </div>
          </div>

          {settings.routingMode === 'after_hours' && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">Business Hours</h2>
              <p className="mb-4 text-xs text-gray-400">
                During these hours, calls go to your clinic phone. Outside these hours, the AI receptionist answers.
              </p>

              <div className="space-y-2">
                {DAY_ORDER.map((day) => {
                  const currentDay = settings.businessHours[day];
                  return (
                    <div
                      key={day}
                      className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm ${
                        currentDay?.enabled ? 'border border-blue-100 bg-blue-50' : 'border border-gray-100 bg-gray-50'
                      }`}
                    >
                      <span className={`w-28 font-medium ${currentDay?.enabled ? 'text-blue-800' : 'text-gray-400'}`}>
                        {DAY_LABELS[day]}
                      </span>
                      {currentDay?.enabled ? (
                        <span className="text-blue-700">
                          {currentDay.start} - {currentDay.end}
                        </span>
                      ) : (
                        <span className="text-xs italic text-gray-400">Closed - AI answers</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {openDays.length > 0 && (
                <div className="mt-4 rounded-lg border border-green-100 bg-green-50 p-3">
                  <p className="text-xs text-green-700">
                    <strong>Open:</strong> {openDays.map((day) => DAY_LABELS[day]).join(', ')}
                    {' | '}
                    AI active on: {closedDays.length > 0 ? closedDays.map((day) => DAY_LABELS[day]).join(', ') : 'No closed days configured'}
                  </p>
                </div>
              )}
            </div>
          )}

          {settings.routingMode === 'always_ai' && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2">
                <FaRobot className="text-blue-500" />
                <p className="text-sm font-medium text-blue-800">
                  AI Receptionist is set to always answer - all inbound calls go directly to Retell AI.
                </p>
              </div>
            </div>
          )}

          {settings.routingMode === 'off' && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">AI reception is currently off. All calls follow standard Twilio routing.</p>
            </div>
          )}

          {settings.afterHoursMessage && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Fallback Message</h2>
              <p className="text-sm italic leading-relaxed text-gray-600">"{settings.afterHoursMessage}"</p>
              <p className="mt-2 text-xs text-gray-400">Played if the AI receptionist is unavailable.</p>
            </div>
          )}

          {settings.sendMissedCallsToAi && (
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <div className="flex items-center gap-2">
                <FaCheckCircle className="text-yellow-500" />
                <p className="text-sm font-medium text-yellow-800">
                  Missed calls during business hours are also routed to the AI receptionist.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Configuration</h2>
            <p className="mb-3 text-xs text-gray-400">
              To change your AI reception settings, contact your CliniMedia account manager.
            </p>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 px-4 py-3">
                <p className="mb-1 text-xs text-gray-400">Clinic Name</p>
                <p className="font-medium text-gray-800">{config.clinicName}</p>
              </div>
              {config.twilioPhoneNumber && (
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Tracking Number</p>
                  <p className="font-medium text-gray-800">{config.twilioPhoneNumber}</p>
                </div>
              )}
              {settings.retellAgentId && (
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">AI Agent</p>
                  <p className="break-all font-mono text-xs text-gray-600">{settings.retellAgentId}</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Recent AI Calls</h2>
            {calls.length === 0 ? (
              <p className="text-sm text-gray-500">No AI receptionist calls have been recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {calls.map((call) => (
                  <button
                    key={call.retellCallId}
                    onClick={() => setSelectedCall(call)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {call.callAnalysis?.callerName || call.fromNumber || 'Unknown caller'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(call.startTimestamp)}
                        </p>
                        {call.callAnalysis?.callSummary && (
                          <p className="mt-2 line-clamp-2 text-sm text-gray-600">
                            {call.callAnalysis.callSummary}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 sm:text-right">
                        <span>Status: {call.callStatus || 'unknown'}</span>
                        <span>Urgency: {call.callAnalysis?.urgencyLevel || 'n/a'}</span>
                        <span>Duration: {formatDuration(call.durationMs)}</span>
                        <span>Patient: {call.callAnalysis?.patientType || 'n/a'}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedCall && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Selected AI Call</h2>
                <button
                  onClick={() => setSelectedCall(null)}
                  className="text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-gray-600"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Call Time</p>
                  <p className="text-sm font-medium text-gray-800">{formatDateTime(selectedCall.startTimestamp)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Caller</p>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedCall.callAnalysis?.callerName || selectedCall.fromNumber || 'Unknown caller'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Callback Number</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.callbackNumber || selectedCall.fromNumber || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Status</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callStatus || 'Unknown'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Duration</p>
                  <p className="text-sm font-medium text-gray-800">{formatDuration(selectedCall.durationMs)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Urgency</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.urgencyLevel || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Patient Type</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.patientType || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Service Requested</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.serviceRequested || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Disconnection Reason</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.disconnectionReason || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Email</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.email || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Sentiment</p>
                  <p className="text-sm font-medium text-gray-800">{formatSentiment(selectedCall.callAnalysis?.userSentiment)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Preferred Callback Time</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.preferredCallbackTime || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Preferred Location</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.preferredLocation || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Location Works</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.locationWorksForCaller || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Appointment Intent</p>
                  <p className="text-sm font-medium text-gray-800">{formatBoolean(selectedCall.callAnalysis?.appointmentIntent)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Call Successful</p>
                  <p className="text-sm font-medium text-gray-800">
                    {selectedCall.callAnalysis?.callSuccessful == null ? 'n/a' : selectedCall.callAnalysis.callSuccessful ? 'Yes' : 'No'}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Booking Readiness</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.bookingReadiness || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Best Next Action</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.bestNextAction || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Insurance Mentioned</p>
                  <p className="text-sm font-medium text-gray-800">{formatBoolean(selectedCall.callAnalysis?.insuranceMentioned)}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Insurance Provider</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.insuranceProvider || 'n/a'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs text-gray-400">Pain Level</p>
                  <p className="text-sm font-medium text-gray-800">{selectedCall.callAnalysis?.painLevel ?? 'n/a'}</p>
                </div>
                {selectedCall.twilioCallSid && (
                  <div className="rounded-lg bg-gray-50 px-4 py-3">
                    <p className="mb-1 text-xs text-gray-400">Twilio Call SID</p>
                    <p className="break-all font-mono text-xs text-gray-700">{selectedCall.twilioCallSid}</p>
                  </div>
                )}
              </div>

              {selectedCall.callAnalysis?.callSummary && (
                <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-blue-500">Summary</p>
                  <p className="text-sm text-blue-900">{selectedCall.callAnalysis.callSummary}</p>
                </div>
              )}

              {selectedCall.callAnalysis?.reasonForCall && (
                <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Reason For Call</p>
                  <p className="text-sm text-gray-700">{selectedCall.callAnalysis.reasonForCall}</p>
                </div>
              )}

              {selectedCall.callAnalysis?.symptomsMentioned && (
                <div className="mt-4 rounded-lg bg-red-50 px-4 py-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-red-500">Symptoms Mentioned</p>
                  <p className="text-sm text-red-900">{selectedCall.callAnalysis.symptomsMentioned}</p>
                </div>
              )}

              {selectedCall.callAnalysis?.recommendedFollowUp && (
                <div className="mt-4 rounded-lg bg-yellow-50 px-4 py-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-yellow-600">Recommended Follow Up</p>
                  <p className="text-sm text-yellow-900">{selectedCall.callAnalysis.recommendedFollowUp}</p>
                </div>
              )}

              {selectedCall.callAnalysis?.bestNextAction && (
                <div className="mt-4 rounded-lg bg-green-50 px-4 py-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-green-600">Reception Next Action</p>
                  <p className="text-sm text-green-900">{selectedCall.callAnalysis.bestNextAction}</p>
                </div>
              )}

              {selectedCall.recordingUrl && (
                <div className="mt-4">
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Recording</p>
                  <audio controls className="w-full" src={selectedCall.recordingUrl} />
                </div>
              )}

              {selectedCall.transcript && (
                <div className="mt-4 rounded-lg border border-gray-200 px-4 py-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Transcript</p>
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">{selectedCall.transcript}</pre>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AIReceptionPage;
