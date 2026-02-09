import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FaQrcode,
  FaChartBar,
  FaExclamationTriangle,
  FaSpinner,
  FaTimes,
  FaExternalLinkAlt,
  FaCheck,
} from "react-icons/fa";

const API = import.meta.env.VITE_API_BASE_URL;

interface CampaignStats {
  scans: number;
  pathGreat: number;
  pathConcern: number;
  reviewsGenerated: number;
  copyClicks: number;
  googleClicks: number;
  concernSubmissions: number;
  concernsNew: number;
  scanToGenerate: string;
  generateToCopy: string;
  copyToGoogle: string;
  recentSessions: any[];
}

interface Concern {
  _id: string;
  patientName?: string;
  patientContact?: string;
  concernText: string;
  status: "new" | "reviewed" | "resolved";
  createdAt: string;
}

interface Campaign {
  _id: string;
  slug: string;
  clinicName: string;
  googleReviewUrl: string;
  isActive: boolean;
  logoUrl?: string;
  createdAt: string;
  stats?: {
    sessionCount: number;
    copiedCount: number;
    concernCount: number;
  };
}

const getToken = () => localStorage.getItem("customerToken");

const CustomerQRReviewsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats modal
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // Concerns modal
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [showConcerns, setShowConcerns] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/qr-reviews/my-campaigns`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setCampaigns(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (campaignId: string) => {
    setStatsLoading(true);
    try {
      const res = await axios.get(`${API}/qr-reviews/my-campaigns/${campaignId}/stats`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setStats(res.data);
      setShowStats(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch stats");
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchConcerns = async (campaignId: string) => {
    try {
      const res = await axios.get(`${API}/qr-reviews/my-campaigns/${campaignId}/concerns`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setConcerns(res.data);
      setShowConcerns(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch concerns");
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-16">
        <FaSpinner className="animate-spin text-[#98c6d5] text-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#303b45]">QR Reviews</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track how your review campaigns are performing
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2">&times;</button>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="text-center py-16">
          <FaQrcode className="text-gray-300 text-5xl mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No review campaigns yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Contact your administrator to set up a QR review campaign.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign._id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    {campaign.logoUrl && (
                      <img src={campaign.logoUrl} alt="" className="h-8 w-8 object-contain rounded" />
                    )}
                    <h3 className="text-base font-semibold text-[#303b45]">{campaign.clinicName}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        campaign.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {campaign.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 mb-2">
                    /r/{campaign.slug}
                  </p>

                  {/* Quick stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FaChartBar className="text-[#98c6d5]" />
                      {campaign.stats?.sessionCount || 0} scans
                    </span>
                    <span className="flex items-center gap-1">
                      <FaCheck className="text-green-500" />
                      {campaign.stats?.copiedCount || 0} reviews copied
                    </span>
                    {(campaign.stats?.concernCount || 0) > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <FaExclamationTriangle />
                        {campaign.stats?.concernCount} concerns
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => fetchStats(campaign._id)}
                    disabled={statsLoading}
                    className="p-2 text-gray-400 hover:text-[#98c6d5] hover:bg-gray-50 rounded-lg transition-colors"
                    title="View Analytics"
                  >
                    <FaChartBar />
                  </button>
                  <button
                    onClick={() => fetchConcerns(campaign._id)}
                    className="p-2 text-gray-400 hover:text-orange-500 hover:bg-gray-50 rounded-lg transition-colors relative"
                    title="View Concerns"
                  >
                    <FaExclamationTriangle />
                    {(campaign.stats?.concernCount || 0) > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center">
                        {campaign.stats!.concernCount}
                      </span>
                    )}
                  </button>
                  <a
                    href={`/r/${campaign.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-50 rounded-lg transition-colors"
                    title="Preview Page"
                  >
                    <FaExternalLinkAlt />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats Modal */}
      {showStats && stats && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-[#303b45]">Campaign Analytics</h2>
              <button onClick={() => setShowStats(false)} className="text-gray-400 hover:text-gray-600">
                <FaTimes />
              </button>
            </div>
            <div className="p-5 space-y-6">
              {/* Funnel metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-600">{stats.scans}</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">Scans</p>
                </div>
                <div className="bg-teal-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-teal-600">{stats.pathGreat}</p>
                  <p className="text-[10px] text-teal-500 mt-0.5">Great Path</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-amber-600">{stats.pathConcern}</p>
                  <p className="text-[10px] text-amber-500 mt-0.5">Concern Path</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-purple-600">{stats.reviewsGenerated}</p>
                  <p className="text-[10px] text-purple-500 mt-0.5">Reviews Generated</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-green-600">{stats.copyClicks}</p>
                  <p className="text-[10px] text-green-500 mt-0.5">Copies</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-indigo-600">{stats.googleClicks}</p>
                  <p className="text-[10px] text-indigo-500 mt-0.5">Google Clicks</p>
                </div>
              </div>

              {/* Conversion rates */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Conversion Funnel</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-600">Scan → Generate</span>
                    <span className="font-semibold text-[#303b45]">{stats.scanToGenerate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-600">Generate → Copy</span>
                    <span className="font-semibold text-[#303b45]">{stats.generateToCopy}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-3">
                    <span className="text-gray-600">Copy → Google</span>
                    <span className="font-semibold text-[#303b45]">{stats.copyToGoogle}%</span>
                  </div>
                </div>
              </div>

              {/* Concerns summary */}
              {(stats.concernSubmissions > 0 || stats.concernsNew > 0) && (
                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                  <FaExclamationTriangle className="text-red-400" />
                  <div className="text-sm">
                    <span className="text-red-600 font-medium">{stats.concernSubmissions} concerns</span>
                    <span className="text-red-400 ml-1">({stats.concernsNew} unreviewed)</span>
                  </div>
                </div>
              )}

              {/* Recent sessions */}
              {stats.recentSessions.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Sessions</h3>
                  <div className="space-y-2">
                    {stats.recentSessions.slice(0, 10).map((s: any) => (
                      <div key={s._id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">
                          {s.patientName || "Anonymous"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              s.status === "copied"
                                ? "bg-green-100 text-green-700"
                                : s.status === "concern_submitted"
                                ? "bg-red-100 text-red-700"
                                : s.status === "review_generated"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {s.status}
                          </span>
                          <span className="text-gray-400">
                            {new Date(s.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Concerns Modal */}
      {showConcerns && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-[#303b45]">Patient Concerns</h2>
              <button onClick={() => setShowConcerns(false)} className="text-gray-400 hover:text-gray-600">
                <FaTimes />
              </button>
            </div>
            <div className="p-5">
              {concerns.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No concerns submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {concerns.map((c) => (
                    <div key={c._id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-[#303b45]">
                            {c.patientName || "Anonymous"}
                          </p>
                          {c.patientContact && (
                            <p className="text-xs text-gray-400">{c.patientContact}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              c.status === "new"
                                ? "bg-red-100 text-red-700"
                                : c.status === "reviewed"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {c.status}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{c.concernText}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerQRReviewsPage;
