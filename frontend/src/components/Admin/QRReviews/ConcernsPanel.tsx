import React from "react";
import { FaTimes, FaCheckCircle, FaEye, FaClock } from "react-icons/fa";
import type { Concern } from "./QRReviewsLogic";

interface Props {
  concerns: Concern[];
  campaignId: string;
  onUpdateStatus: (campaignId: string, concernId: string, status: string) => void;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: "New", color: "bg-red-100 text-red-700", icon: <FaClock className="text-[10px]" /> },
  reviewed: { label: "Reviewed", color: "bg-yellow-100 text-yellow-700", icon: <FaEye className="text-[10px]" /> },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-700", icon: <FaCheckCircle className="text-[10px]" /> },
};

const ConcernsPanel: React.FC<Props> = ({ concerns, campaignId, onUpdateStatus, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-[#303b45]">
            Patient Concerns ({concerns.length})
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {concerns.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No concerns submitted yet.</p>
          ) : (
            <div className="space-y-4">
              {concerns.map((concern) => {
                const config = statusConfig[concern.status] || statusConfig.new;
                return (
                  <div
                    key={concern._id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.color}`}
                          >
                            {config.icon} {config.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(concern.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {(concern.patientName || concern.patientContact) && (
                          <div className="text-sm text-gray-600 mb-2">
                            {concern.patientName && (
                              <span className="font-medium">{concern.patientName}</span>
                            )}
                            {concern.patientName && concern.patientContact && " - "}
                            {concern.patientContact && (
                              <span className="text-[#98c6d5]">{concern.patientContact}</span>
                            )}
                          </div>
                        )}

                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border-l-3 border-[#98c6d5]">
                          {concern.concernText}
                        </p>
                      </div>

                      {/* Status actions */}
                      <div className="flex flex-col gap-1 flex-shrink-0">
                        {concern.status !== "reviewed" && (
                          <button
                            onClick={() => onUpdateStatus(campaignId, concern._id, "reviewed")}
                            className="px-2 py-1 text-[10px] bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100 transition-colors"
                          >
                            Mark Reviewed
                          </button>
                        )}
                        {concern.status !== "resolved" && (
                          <button
                            onClick={() => onUpdateStatus(campaignId, concern._id, "resolved")}
                            className="px-2 py-1 text-[10px] bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConcernsPanel;
