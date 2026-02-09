import React from "react";
import { useQRReview } from "./QRReviewLogic";
import { FaCopy, FaCheck, FaRedo, FaExternalLinkAlt, FaArrowLeft } from "react-icons/fa";

const CATEGORY_COLORS: Record<string, string> = {
  staff: "border-blue-300 text-blue-700",
  clinic: "border-green-300 text-green-700",
  process: "border-purple-300 text-purple-700",
  provider: "border-orange-300 text-orange-700",
  service: "border-pink-300 text-pink-700",
};

const CATEGORY_SELECTED: Record<string, string> = {
  staff: "bg-blue-500 border-blue-500 text-white",
  clinic: "bg-green-500 border-green-500 text-white",
  process: "bg-purple-500 border-purple-500 text-white",
  provider: "bg-orange-500 border-orange-500 text-white",
  service: "bg-pink-500 border-pink-500 text-white",
};

const QRReviewPage: React.FC = () => {
  const {
    campaign,
    step,
    setStep,
    error,
    setError,
    patientName,
    setPatientName,
    selectedHighlights,
    toggleHighlight,
    freeText,
    setFreeText,
    staffName,
    setStaffName,
    reviewLength,
    setReviewLength,
    chipCount,
    canSelectMore,
    hasEnoughChips,
    maxChips,
    minChips,
    goToWhatStoodOut,
    submitHighlightsAndGenerate,
    startConcernFlow,
    reviewText,
    generating,
    remainingGenerations,
    copied,
    googleReviewUrl,
    regenerateReview,
    copyReview,
    openGoogleReview,
    concernText,
    setConcernText,
    patientContact,
    setPatientContact,
    submittingConcern,
    submitConcern,
  } = useQRReview();

  // Loading state
  if (step === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#98c6d5]"></div>
      </div>
    );
  }

  // Not found
  if (step === "not_found") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <p className="text-gray-500 text-lg">This review page is not available.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (step === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <p className="text-red-500 text-lg">{error || "Something went wrong."}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-[#98c6d5] text-white rounded-lg hover:bg-[#7ab4c5] transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          {campaign?.logoUrl && (
            <img
              src={campaign.logoUrl}
              alt={campaign.clinicName}
              className="h-16 w-auto object-contain mx-auto mb-3"
            />
          )}
          <h1 className="text-2xl font-bold text-[#303b45]">{campaign?.clinicName}</h1>
          {step === "entry" && (
            <p className="text-gray-500 mt-1">We'd love to hear about your experience</p>
          )}
          {step === "what_stood_out" && (
            <p className="text-gray-500 mt-1">What stood out about your visit?</p>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
            <button onClick={() => setError(null)} className="float-right font-bold">&times;</button>
          </div>
        )}

        {/* ===== ENTRY STEP ===== */}
        {step === "entry" && (
          <div className="space-y-4">
            {/* Patient name (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your First Name <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Sarah"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none transition-all text-black"
              />
            </div>

            {/* Experience buttons */}
            <div className="pt-2 space-y-3">
              <button
                onClick={goToWhatStoodOut}
                className="w-full py-4 bg-[#98c6d5] text-white rounded-xl text-lg font-semibold hover:bg-[#7ab4c5] transition-all shadow-sm hover:shadow-md"
              >
                Great Experience
              </button>
              <button
                onClick={startConcernFlow}
                className="w-full py-3 bg-white text-gray-600 border border-gray-200 rounded-xl text-base hover:bg-gray-50 transition-all"
              >
                I have a concern
              </button>
            </div>
          </div>
        )}

        {/* ===== WHAT STOOD OUT STEP ===== */}
        {step === "what_stood_out" && (
          <div className="space-y-4">
            <button
              onClick={() => setStep("entry")}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <FaArrowLeft className="text-xs" /> Back
            </button>

            {/* Chip selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">
                  Tap what stood out during your visit:
                </p>
                <span className={`text-xs ${chipCount >= minChips ? 'text-green-600' : 'text-gray-400'}`}>
                  {chipCount}/{maxChips} selected
                </span>
              </div>
              {!canSelectMore && (
                <p className="text-xs text-amber-600 mb-2">Maximum of {maxChips} selections reached.</p>
              )}

              {campaign?.experienceHighlights && campaign.experienceHighlights.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {campaign.experienceHighlights.map((chip) => {
                    const isSelected = selectedHighlights.includes(chip.label);
                    const isDisabled = !isSelected && !canSelectMore;
                    const baseColors = CATEGORY_COLORS[chip.category] || "border-gray-300 text-gray-600";
                    const selectedColors = CATEGORY_SELECTED[chip.category] || "bg-[#98c6d5] border-[#98c6d5] text-white";
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => toggleHighlight(chip.label)}
                        disabled={isDisabled}
                        className={`px-3 py-2 rounded-full text-sm border transition-all ${
                          isSelected
                            ? `${selectedColors} shadow-sm`
                            : isDisabled
                            ? "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"
                            : `bg-white ${baseColors} hover:shadow-sm`
                        }`}
                      >
                        {isSelected && <FaCheck className="inline mr-1 text-xs" />}
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Staff name input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Was there a staff member who stood out? <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value.slice(0, 60))}
                placeholder="e.g. Dr. Smith, Sarah"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none transition-all text-black"
              />
            </div>

            {/* Free text input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Anything you'd like to add? <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value.slice(0, 120))}
                placeholder="A short personal note about your visit..."
                rows={2}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none transition-all resize-none text-black"
              />
              <p className="text-xs text-gray-400 text-right mt-0.5">{freeText.length}/120</p>
            </div>

            {/* Review length toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Review length</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewLength("short")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    reviewLength === "short"
                      ? "bg-[#98c6d5] text-white border-[#98c6d5]"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  Short (1-2 sentences)
                </button>
                <button
                  type="button"
                  onClick={() => setReviewLength("medium")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    reviewLength === "medium"
                      ? "bg-[#98c6d5] text-white border-[#98c6d5]"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  Medium (3-5 sentences)
                </button>
              </div>
            </div>

            {/* Generate button */}
            <button
              onClick={submitHighlightsAndGenerate}
              disabled={!hasEnoughChips}
              className={`w-full py-4 rounded-xl text-lg font-semibold transition-all shadow-sm ${
                hasEnoughChips
                  ? "bg-[#98c6d5] text-white hover:bg-[#7ab4c5] hover:shadow-md"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Generate My Review
            </button>
            {!hasEnoughChips && (
              <p className="text-xs text-gray-400 text-center -mt-2">
                Select at least {minChips} highlights to continue
              </p>
            )}
          </div>
        )}

        {/* ===== GREAT EXPERIENCE STEP ===== */}
        {step === "great_experience" && (
          <div className="space-y-4">
            {generating && !reviewText ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#98c6d5] mx-auto mb-3"></div>
                <p className="text-gray-500">Generating your review...</p>
              </div>
            ) : reviewText ? (
              <>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Here's a review based on your experience:</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-700 leading-relaxed">
                    {reviewText}
                  </div>
                  <p className="text-xs text-gray-400 mt-2 italic">
                    Please post only if this reflects your experience.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="space-y-3">
                  {/* Copy button */}
                  <button
                    onClick={copyReview}
                    className={`w-full py-3 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition-all shadow-sm ${
                      copied
                        ? "bg-green-500 text-white"
                        : "bg-[#98c6d5] text-white hover:bg-[#7ab4c5] hover:shadow-md"
                    }`}
                  >
                    {copied ? <FaCheck /> : <FaCopy />}
                    {copied ? "Copied!" : "Copy Review"}
                  </button>

                  {/* Google Review button - shown after copy */}
                  {(copied || googleReviewUrl) && (
                    <button
                      onClick={openGoogleReview}
                      className="w-full py-3 bg-white text-[#303b45] border-2 border-[#98c6d5] rounded-xl text-base font-semibold flex items-center justify-center gap-2 hover:bg-[#f0f9ff] transition-all"
                    >
                      <FaExternalLinkAlt className="text-sm" />
                      Paste on Google Reviews
                    </button>
                  )}

                  {/* Regenerate button or exhausted message */}
                  {remainingGenerations > 0 ? (
                    <button
                      onClick={regenerateReview}
                      disabled={generating}
                      className="w-full py-2.5 text-gray-500 text-sm flex items-center justify-center gap-2 hover:text-gray-700 transition-colors disabled:opacity-50"
                    >
                      <FaRedo className={generating ? "animate-spin" : ""} />
                      {generating ? "Generating..." : `Try a different review (${remainingGenerations} left)`}
                    </button>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-1">
                      No more regenerations available. Try adjusting your selections.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ===== CONCERN STEP ===== */}
        {step === "concern" && (
          <div className="space-y-4">
            <button
              onClick={() => { setStep("entry"); setError(null); }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <FaArrowLeft className="text-xs" /> Back
            </button>

            <p className="text-sm text-gray-600">
              We're sorry to hear that. Please share your concern below and the clinic will follow up with you.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your Email or Phone <span className="text-gray-400">(so we can reach you)</span>
              </label>
              <input
                type="text"
                value={patientContact}
                onChange={(e) => setPatientContact(e.target.value)}
                placeholder="email@example.com or (555) 123-4567"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none transition-all text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What happened? <span className="text-red-400">*</span>
              </label>
              <textarea
                value={concernText}
                onChange={(e) => setConcernText(e.target.value)}
                placeholder="Please describe your concern..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#98c6d5] focus:border-transparent outline-none transition-all resize-none text-black"
              />
            </div>

            <button
              onClick={submitConcern}
              disabled={submittingConcern || concernText.trim().length < 10}
              className="w-full py-3 bg-[#303b45] text-white rounded-xl text-base font-semibold hover:bg-[#1e293b] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingConcern ? "Submitting..." : "Submit Concern"}
            </button>
          </div>
        )}

        {/* ===== CONCERN SUBMITTED ===== */}
        {step === "concern_submitted" && (
          <div className="text-center py-6 space-y-3">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <FaCheck className="text-green-500 text-2xl" />
            </div>
            <h2 className="text-xl font-semibold text-[#303b45]">Thank You</h2>
            <p className="text-gray-500">
              Your concern has been submitted. The clinic will follow up with you shortly.
            </p>
            {googleReviewUrl && (
              <div className="pt-3">
                <p className="text-sm text-gray-500 mb-2">
                  If you'd still like to share your experience publicly:
                </p>
                <button
                  onClick={openGoogleReview}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#303b45] border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all"
                >
                  <FaExternalLinkAlt className="text-xs" />
                  Leave a Google Review
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">Powered by CliniMedia</p>
        </div>
      </div>
    </div>
  );
};

export default QRReviewPage;
