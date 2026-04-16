import React from 'react';
import { FaRobot, FaSpinner, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { useAIReceptionManagement } from './AIReceptionManagementLogic';

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const ROUTING_MODES = [
  { value: 'off',        label: 'Off — never route to AI' },
  { value: 'after_hours', label: 'After hours — AI answers when clinic is closed' },
  { value: 'always_ai',  label: 'Always AI — AI always answers' },
];

const TELEPHONY_MODES = [
  { value: 'sip_uri',      label: 'SIP URI (recommended for Retell)' },
  { value: 'phone_number', label: 'Phone Number (forward to Retell number)' },
  { value: 'custom',       label: 'Custom telephony' },
];

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400';
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';

const AIReceptionManagementPage: React.FC = () => {
  const {
    clinics, selectedClinic, selectClinic,
    settings, setSettings, updateDay,
    handleSave,
    isLoading, isFetchingSettings, isSaving,
    successMsg, errorMsg,
    DAYS, TIMEZONES,
  } = useAIReceptionManagement();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FaRobot className="text-blue-500 text-2xl" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Reception Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure Retell AI receptionist settings per clinic. Calls route based on these settings when Twilio receives an inbound call.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6">
        {/* Clinic list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Select Clinic</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <FaSpinner className="animate-spin text-blue-400 text-xl" />
            </div>
          ) : clinics.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No clinics found.</p>
          ) : (
            <ul className="space-y-1.5">
              {clinics.map(c => {
                const active = selectedClinic?._id === c._id;
                const aiOn = (c as any).aiReceptionistSettings?.enabled;
                return (
                  <li key={c._id}>
                    <button
                      onClick={() => selectClinic(c)}
                      className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? 'bg-blue-50 border border-blue-300 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <span className="truncate">{c.name}</span>
                      {aiOn
                        ? <span className="ml-2 shrink-0 text-[10px] font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">ON</span>
                        : <span className="ml-2 shrink-0 text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">OFF</span>
                      }
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Settings panel */}
        {selectedClinic ? (
          <div className="space-y-5">
            {successMsg && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-300 text-green-700 rounded-xl px-4 py-3 text-sm">
                <FaCheckCircle /> {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-300 text-red-700 rounded-xl px-4 py-3 text-sm">
                <FaTimesCircle /> {errorMsg}
              </div>
            )}

            {isFetchingSettings ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 flex items-center justify-center">
                <FaSpinner className="animate-spin text-blue-400 text-2xl" />
              </div>
            ) : (
              <>
                {/* Enable + Routing */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FaRobot className="text-blue-400" /> General Settings — {selectedClinic.name}
                  </h2>

                  <div className={`rounded-lg border px-4 py-3 text-sm ${
                    selectedClinic.twilioPhoneNumber
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}>
                    {selectedClinic.twilioPhoneNumber ? (
                      <>
                        This clinic&apos;s live Twilio number is <span className="font-semibold">{selectedClinic.twilioPhoneNumber}</span>. AI Reception controls how calls to that number are routed.
                      </>
                    ) : (
                      <>
                        This clinic does not have a Twilio number assigned yet. Connect the clinic&apos;s Twilio number in Twilio Management first, then return here to configure AI routing.
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-800">AI Receptionist Enabled</p>
                      <p className="text-xs text-gray-500 mt-0.5">Master toggle for this clinic</p>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.enabled ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        settings.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Routing Mode</label>
                      <select
                        className={inputCls}
                        value={settings.routingMode}
                        onChange={e => setSettings(s => ({ ...s, routingMode: e.target.value as any }))}
                      >
                        {ROUTING_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Timezone</label>
                      <select
                        className={inputCls}
                        value={settings.timezone}
                        onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))}
                      >
                        {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Send Missed Business-Hours Calls to AI</p>
                      <p className="text-xs text-gray-500 mt-0.5">If clinic doesn't answer during open hours, route to AI</p>
                    </div>
                    <button
                      onClick={() => setSettings(s => ({ ...s, sendMissedCallsToAi: !s.sendMissedCallsToAi }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.sendMissedCallsToAi ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        settings.sendMissedCallsToAi ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Retell connection */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
                  <h2 className="font-semibold text-gray-800">Retell Connection</h2>
                  <div>
                    <label className={labelCls}>Telephony Mode</label>
                    <select
                      className={inputCls}
                      value={settings.telephonyMode}
                      onChange={e => setSettings(s => ({ ...s, telephonyMode: e.target.value as any }))}
                    >
                      {TELEPHONY_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className={labelCls}>Retell Agent ID</label>
                    <input
                      className={inputCls}
                      placeholder="agent_xxxxxxxxxxxxxxxxxxxxxxx"
                      value={settings.retellAgentId ?? ''}
                      onChange={e => setSettings(s => ({ ...s, retellAgentId: e.target.value || null }))}
                    />
                    <p className="text-xs text-gray-400 mt-1">Found in Retell Dashboard → Agents</p>
                  </div>

                  {settings.telephonyMode === 'sip_uri' && (
                    <div>
                      <label className={labelCls}>Retell SIP URI</label>
                      <input
                        className={inputCls}
                        placeholder="sip:xxxxxxxx@sip.retellai.com"
                        value={settings.retellSipUri ?? ''}
                        onChange={e => setSettings(s => ({ ...s, retellSipUri: e.target.value || null }))}
                      />
                    </div>
                  )}

                  {settings.telephonyMode === 'phone_number' && (
                    <div>
                      <label className={labelCls}>Retell Phone Number</label>
                      <input
                        className={inputCls}
                        placeholder="+1xxxxxxxxxx"
                        value={settings.retellPhoneNumber ?? ''}
                        onChange={e => setSettings(s => ({ ...s, retellPhoneNumber: e.target.value || null }))}
                      />
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>After-Hours Message (fallback if AI fails)</label>
                    <textarea
                      rows={2}
                      className={inputCls}
                      placeholder="Thank you for calling. Our office is currently closed..."
                      value={settings.afterHoursMessage ?? ''}
                      onChange={e => setSettings(s => ({ ...s, afterHoursMessage: e.target.value || null }))}
                    />
                  </div>
                </div>

                {/* Business hours */}
                {(settings.routingMode === 'after_hours') && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h2 className="font-semibold text-gray-800 mb-1">Business Hours</h2>
                    <p className="text-xs text-gray-400 mb-4">
                      During these hours calls go to the clinic. Outside these hours, AI answers.
                    </p>
                    <div className="space-y-2">
                      {DAYS.map(day => {
                        const d = settings.businessHours[day] ?? { enabled: false, start: '09:00', end: '17:00' };
                        return (
                          <div key={day} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                            <button
                              onClick={() => updateDay(day, 'enabled', !d.enabled)}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                d.enabled ? 'bg-blue-500' : 'bg-gray-300'
                              }`}
                            >
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                                d.enabled ? 'translate-x-5' : 'translate-x-1'
                              }`} />
                            </button>
                            <span className={`w-10 text-xs font-semibold ${d.enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                              {DAY_LABELS[day]}
                            </span>
                            <input
                              type="time"
                              disabled={!d.enabled}
                              value={d.start}
                              onChange={e => updateDay(day, 'start', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-xs disabled:opacity-40"
                            />
                            <span className="text-xs text-gray-400">to</span>
                            <input
                              type="time"
                              disabled={!d.enabled}
                              value={d.end}
                              onChange={e => updateDay(day, 'end', e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-xs disabled:opacity-40"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-60"
                  >
                    {isSaving && <FaSpinner className="animate-spin text-xs" />}
                    {isSaving ? 'Saving…' : 'Save Settings'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 flex flex-col items-center justify-center text-center text-gray-400">
            <FaRobot className="text-5xl mb-3 text-gray-200" />
            <p className="text-sm">Select a clinic to configure its AI receptionist.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIReceptionManagementPage;
