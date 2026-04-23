import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FaChartLine,
  FaSpinner,
  FaCalendarAlt,
  FaSyncAlt,
  FaBuilding,
  FaBullhorn,
  FaPhone,
  FaRobot,
  FaInstagram,
  FaFacebook,
  FaGoogle,
  FaStar,
} from 'react-icons/fa';
import logo1 from '../../../assets/CliniMedia_Logo1.png';

interface Customer {
  _id: string;
  name: string;
  email: string;
  location?: string;
}

interface ReportSection {
  id: string;
  title: string;
  summary?: Record<string, any>;
  highlights?: string[];
  campaigns?: Array<Record<string, any>>;
  recentLeads?: Array<Record<string, any>>;
  topPosts?: Array<Record<string, any>>;
  topReasons?: Array<Record<string, any>>;
  pageInfo?: Record<string, any>;
  error?: string;
}

interface ReportPayload {
  generatedAt: string;
  reportTitle: string;
  period: {
    start: string;
    end: string;
    label: string;
  };
  clinic: {
    id: string;
    name: string;
    email: string;
    location?: string;
    logoUrl?: string | null;
  };
  overview: {
    totalLeads: number;
    bookedMetaAppointments: number;
    totalCalls: number;
    newPatientCalls: number;
    callAppointmentsBooked: number;
    aiCalls: number;
  };
  sections: ReportSection[];
  recommendations: string[];
  availableIntegrations: Record<string, boolean>;
}

const PRESETS = [
  { value: 'last14Days', label: 'Biweekly Report' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'last30Days', label: 'Last 30 Days' },
];

const sectionIcons: Record<string, React.ReactNode> = {
  metaLeads: <FaBullhorn className="text-pink-500" />,
  callTracking: <FaPhone className="text-emerald-500" />,
  aiReception: <FaRobot className="text-violet-500" />,
  googleBusiness: <FaGoogle className="text-blue-500" />,
  googleAds: <FaGoogle className="text-amber-500" />,
  instagram: <FaInstagram className="text-fuchsia-500" />,
  facebook: <FaFacebook className="text-sky-600" />,
  qrReviews: <FaStar className="text-yellow-500" />,
};

const MarketingReportsPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('last14Days');
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const adminToken = localStorage.getItem('adminToken');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const response = await axios.get(`${apiBaseUrl}/customers`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        setCustomers(response.data || []);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load clinics.');
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, [apiBaseUrl, adminToken]);

  const selectedClinic = useMemo(
    () => customers.find((customer) => customer._id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const handleGenerateReport = async () => {
    if (!selectedCustomerId) {
      setError('Please select a clinic first.');
      return;
    }

    try {
      setGenerating(true);
      setError(null);
      const response = await axios.get(`${apiBaseUrl}/reports/marketing`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        params: {
          customerId: selectedCustomerId,
          preset: selectedPreset,
        },
      });
      setReport(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.details || 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const renderSummaryGrid = (summary?: Record<string, any>) => {
    if (!summary) return null;
    const entries = Object.entries(summary).filter(([, value]) => value !== null && value !== undefined && value !== '');
    if (!entries.length) return null;

    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {entries.map(([key, value]) => (
          <div key={key} className="border border-gray-200 rounded-lg bg-gray-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{String(value)}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <img src={logo1} alt="CliniMedia logo" className="h-14 w-auto object-contain" />
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <FaChartLine />
                Admin Reports
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Marketing Report Generator</h1>
              <p className="mt-1 text-sm text-gray-600">
                Generate a clean clinic report using the connected source integrations only.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,220px)_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Clinic</span>
              <select
                value={selectedCustomerId}
                onChange={(event) => setSelectedCustomerId(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                disabled={loadingCustomers}
              >
                <option value="">Select clinic</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Timeline</span>
              <select
                value={selectedPreset}
                onChange={(event) => setSelectedPreset(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={generating || loadingCustomers}
              className="mt-[21px] inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating ? <FaSpinner className="mr-2 animate-spin" /> : <FaCalendarAlt className="mr-2" />}
              Generate Report
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loadingCustomers && (
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-5 text-sm text-gray-600">
            <FaSpinner className="animate-spin text-blue-500" />
            Loading clinics...
          </div>
        )}

        {report && (
          <>
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <img src={logo1} alt="CliniMedia logo" className="h-12 w-auto object-contain" />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{report.reportTitle}</div>
                    <h2 className="mt-1 text-2xl font-bold text-gray-900">{report.clinic.name}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <FaBuilding className="text-gray-400" />
                        {report.clinic.location || selectedClinic?.location || 'Clinic'}
                      </span>
                      <span>{report.period.start} to {report.period.end}</span>
                      <span>Generated {new Date(report.generatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={generating}
                  className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <FaSyncAlt className="mr-2" />
                  Refresh Data
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Leads</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">{report.overview.totalLeads}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Booked Leads</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">{report.overview.bookedMetaAppointments}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tracked Calls</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">{report.overview.totalCalls}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">New Patient Calls</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">{report.overview.newPatientCalls}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Call Bookings</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">{report.overview.callAppointmentsBooked}</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">AI Calls</div>
                <div className="mt-2 text-3xl font-bold text-gray-900">{report.overview.aiCalls}</div>
              </div>
            </div>

            {report.recommendations.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-900">Missing / Not Connected</div>
                <ul className="mt-2 space-y-1 text-sm text-amber-800">
                  {report.recommendations.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              {report.sections.map((section) => (
                <section key={section.id} className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg">
                      {sectionIcons[section.id] || <FaChartLine className="text-slate-700" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                      {section.error && <p className="text-sm text-red-600">{section.error}</p>}
                    </div>
                  </div>

                  {renderSummaryGrid(section.summary)}

                  {section.highlights && section.highlights.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Highlights</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {section.highlights.map((highlight) => (
                          <div key={highlight} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            {highlight}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {section.campaigns && section.campaigns.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Campaign Breakdown</div>
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              {Object.keys(section.campaigns[0]).map((header) => (
                                <th key={header} className="px-3 py-2 text-left font-semibold text-gray-600">
                                  {header.replace(/([A-Z])/g, ' $1').trim()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {section.campaigns.map((row, index) => (
                              <tr key={`${section.id}-${index}`}>
                                {Object.entries(row).map(([key, value]) => (
                                  <td key={key} className="px-3 py-2 text-gray-700">
                                    {String(value)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {section.recentLeads && section.recentLeads.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Recent Leads</div>
                      <div className="grid gap-2">
                        {section.recentLeads.map((lead, index) => (
                          <div key={`${lead.name}-${index}`} className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-700">
                            <div className="font-medium text-gray-900">{lead.name}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              {lead.campaignName || 'No campaign name'} • {new Date(lead.emailDate).toLocaleDateString()} • {lead.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {section.topPosts && section.topPosts.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Top Posts</div>
                      <div className="grid gap-2">
                        {section.topPosts.map((post, index) => (
                          <div key={`${post.permalink}-${index}`} className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-700">
                            <div className="font-medium text-gray-900">{post.caption || 'Instagram post'}</div>
                            <div className="mt-1 text-xs text-gray-500">
                              Reach {post.reach} • Engagement {post.engagement} • Plays {post.plays}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {section.topReasons && section.topReasons.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Top Reasons For Calling</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {section.topReasons.map((item, index) => (
                          <div key={`${item.reason}-${index}`} className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-700">
                            <div className="font-medium text-gray-900">{item.reason}</div>
                            <div className="mt-1 text-xs text-gray-500">{item.count} calls</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MarketingReportsPage;
