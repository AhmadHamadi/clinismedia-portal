import React from "react";
import { useQRReviews } from "./QRReviewsLogic";
import CampaignFormModal from "./CampaignFormModal";
import ConcernsPanel from "./ConcernsPanel";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaQrcode,
  FaExclamationTriangle,
  FaChartBar,
  FaCopy,
  FaDownload,
  FaTimes,
  FaExternalLinkAlt,
  FaCheckCircle,
} from "react-icons/fa";

const QRReviewsPage: React.FC = () => {
  const {
    campaigns,
    customers,
    loading,
    error,
    setError,
    saving,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    showForm,
    editingCampaign,
    openCreateForm,
    openEditForm,
    closeForm,
    showConcerns,
    setShowConcerns,
    concerns,
    selectedCampaignId,
    fetchConcerns,
    updateConcernStatus,
    showStats,
    setShowStats,
    stats,
    fetchStats,
    showQR,
    setShowQR,
    qrData,
    fetchQRCode,
    downloadQR,
  } = useQRReviews();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#303b45]">QR Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage review campaigns for your clinics
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-4 py-2 bg-[#98c6d5] text-white rounded-lg hover:bg-[#7ab4c5] transition-colors text-sm font-medium"
        >
          <FaPlus /> New Campaign
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-2">&times;</button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#98c6d5]"></div>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16">
          <FaQrcode className="text-gray-300 text-5xl mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No campaigns yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first QR review campaign to get started.</p>
          <button
            onClick={openCreateForm}
            className="mt-4 px-6 py-2 bg-[#98c6d5] text-white rounded-lg hover:bg-[#7ab4c5] transition-colors text-sm"
          >
            Create Campaign
          </button>
        </div>
      ) : (
        /* Campaign cards */
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign._id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
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
                    {campaign.customerId && (
                      <span className="ml-2">
                        &middot; {campaign.customerId.name}
                      </span>
                    )}
                  </p>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FaChartBar className="text-[#98c6d5]" />
                      {campaign.stats?.sessionCount || 0} sessions
                    </span>
                    <span className="flex items-center gap-1">
                      <FaCopy className="text-green-500" />
                      {campaign.stats?.copiedCount || 0} copied
                    </span>
                    {(campaign.stats?.concernCount || 0) > 0 && (
                      <span className="flex items-center gap-1 text-red-500">
                        <FaExclamationTriangle />
                        {campaign.stats?.concernCount} new concerns
                      </span>
                    )}
                  </div>

                  {/* Highlight tags */}
                  {campaign.experienceHighlights && campaign.experienceHighlights.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {campaign.experienceHighlights.slice(0, 5).map((h, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px]">
                          {h.label}
                        </span>
                      ))}
                      {campaign.experienceHighlights.length > 5 && (
                        <span className="px-2 py-0.5 text-gray-400 text-[10px]">
                          +{campaign.experienceHighlights.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => fetchQRCode(campaign._id)}
                    className="p-2 text-gray-400 hover:text-[#98c6d5] hover:bg-gray-50 rounded-lg transition-colors"
                    title="QR Code"
                  >
                    <FaQrcode />
                  </button>
                  <button
                    onClick={() => fetchStats(campaign._id)}
                    className="p-2 text-gray-400 hover:text-[#98c6d5] hover:bg-gray-50 rounded-lg transition-colors"
                    title="View Stats"
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
                  <button
                    onClick={() => openEditForm(campaign)}
                    className="p-2 text-gray-400 hover:text-blue-500 hover:bg-gray-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => deleteCampaign(campaign._id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign Form Modal */}
      {showForm && (
        <CampaignFormModal
          campaign={editingCampaign}
          customers={customers}
          saving={saving}
          onSave={(data) =>
            editingCampaign
              ? updateCampaign(editingCampaign._id, data)
              : createCampaign(data)
          }
          onClose={closeForm}
        />
      )}

      {/* Concerns Panel */}
      {showConcerns && selectedCampaignId && (
        <ConcernsPanel
          concerns={concerns}
          campaignId={selectedCampaignId}
          onUpdateStatus={updateConcernStatus}
          onClose={() => setShowConcerns(false)}
        />
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
                          {s.selectedHighlights?.length > 0 && ` - ${s.selectedHighlights.length} highlights`}
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

      {/* QR Code Modal */}
      {showQR && qrData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold text-[#303b45]">QR Code</h2>
              <button onClick={() => setShowQR(false)} className="text-gray-400 hover:text-gray-600">
                <FaTimes />
              </button>
            </div>
            <div className="p-5 text-center">
              {qrData.format === "svg" ? (
                <div
                  className="mx-auto mb-4"
                  dangerouslySetInnerHTML={{ __html: qrData.qrCodeData }}
                  style={{ maxWidth: 300 }}
                />
              ) : (
                <img src={qrData.qrCodeData} alt="QR Code" className="mx-auto mb-4" style={{ maxWidth: 300 }} />
              )}

              <p className="text-xs text-gray-400 mb-4 flex items-center justify-center gap-1">
                <FaExternalLinkAlt className="text-[10px]" />
                {qrData.url}
              </p>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => {
                    if (qrData.format !== "png") {
                      fetchQRCode(selectedCampaignId!, "png");
                    }
                    downloadQR("png");
                  }}
                  className="flex items-center gap-1 px-4 py-2 bg-[#98c6d5] text-white rounded-lg hover:bg-[#7ab4c5] transition-colors text-sm"
                >
                  <FaDownload /> PNG
                </button>
                <button
                  onClick={async () => {
                    if (qrData.format !== "svg") {
                      await fetchQRCode(selectedCampaignId!, "svg");
                    }
                    downloadQR("svg");
                  }}
                  className="flex items-center gap-1 px-4 py-2 bg-white text-[#303b45] border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <FaDownload /> SVG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRReviewsPage;
