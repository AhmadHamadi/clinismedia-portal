import { useState, useEffect } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE_URL;

export interface ChipInfo {
  label: string;
  category: string;
}

export interface CampaignInfo {
  clinicName: string;
  experienceHighlights: ChipInfo[];
  isActive: boolean;
  logoUrl?: string | null;
}

export type FlowStep =
  | "loading"
  | "not_found"
  | "entry"
  | "what_stood_out"
  | "great_experience"
  | "concern"
  | "concern_submitted"
  | "error";

const MAX_CHIPS = 4;
const MIN_CHIPS = 2;

export const useQRReview = () => {
  const { slug } = useParams<{ slug: string }>();

  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [step, setStep] = useState<FlowStep>("loading");
  const [error, setError] = useState<string | null>(null);

  // Session state
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("");
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>([]);

  // New inputs
  const [freeText, setFreeText] = useState("");
  const [staffName, setStaffName] = useState("");
  const [reviewLength, setReviewLength] = useState<"short" | "medium">("medium");

  // Review state
  const [reviewText, setReviewText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [remainingGenerations, setRemainingGenerations] = useState(6);
  const [copied, setCopied] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");

  // Concern state
  const [concernText, setConcernText] = useState("");
  const [patientContact, setPatientContact] = useState("");
  const [submittingConcern, setSubmittingConcern] = useState(false);

  // Chip selection helpers
  const chipCount = selectedHighlights.length;
  const canSelectMore = chipCount < MAX_CHIPS;
  const hasEnoughChips = chipCount >= MIN_CHIPS;

  // Fetch campaign on mount
  useEffect(() => {
    if (!slug) {
      setStep("not_found");
      return;
    }
    fetchCampaign();
  }, [slug]);

  const fetchCampaign = async () => {
    try {
      const res = await axios.get(`${API}/qr-reviews/public/${slug}`);
      setCampaign(res.data);
      setStep("entry");
    } catch (err: any) {
      if (err.response?.status === 404) {
        setStep("not_found");
      } else {
        setError("Failed to load. Please try again.");
        setStep("error");
      }
    }
  };

  const toggleHighlight = (label: string) => {
    setSelectedHighlights((prev) => {
      if (prev.includes(label)) {
        return prev.filter((h) => h !== label);
      }
      // Enforce max chips
      if (prev.length >= MAX_CHIPS) return prev;
      return [...prev, label];
    });
  };

  // Called when patient clicks "Great Experience" — go to chip selection step
  const goToWhatStoodOut = () => {
    setStep("what_stood_out");
  };

  // Called when patient clicks "Generate My Review" on the what_stood_out step
  const submitHighlightsAndGenerate = async () => {
    if (!hasEnoughChips) {
      setError(`Please select at least ${MIN_CHIPS} highlights.`);
      return;
    }

    try {
      const res = await axios.post(`${API}/qr-reviews/public/${slug}/session`, {
        patientName: patientName.trim() || undefined,
        selectedHighlights,
        freeText: freeText.trim() || undefined,
        staffName: staffName.trim() || undefined,
        reviewLength,
        pathSelected: "great",
      });
      setSessionToken(res.data.sessionToken);
      setStep("great_experience");
      await generateReview(res.data.sessionToken);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError(err.response.data.error || "Please wait before starting another session.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  // Called when patient clicks "I have a concern"
  const startConcernFlow = async () => {
    try {
      const res = await axios.post(`${API}/qr-reviews/public/${slug}/session`, {
        patientName: patientName.trim() || undefined,
        pathSelected: "concern",
      });
      setSessionToken(res.data.sessionToken);
      setStep("concern");
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError(err.response.data.error || "Please wait before starting another session.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  const generateReview = async (token?: string) => {
    const tkn = token || sessionToken;
    if (!tkn) return;

    setGenerating(true);
    setError(null);
    try {
      const res = await axios.post(`${API}/qr-reviews/public/${slug}/generate`, {
        sessionToken: tkn,
      });
      setReviewText(res.data.reviewText);
      setRemainingGenerations(res.data.remainingGenerations);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError(err.response.data.error || "Maximum regenerations reached.");
        setRemainingGenerations(0);
      } else {
        setError("Failed to generate review. Please try again.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const regenerateReview = async () => {
    if (!sessionToken || remainingGenerations <= 0) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await axios.post(`${API}/qr-reviews/public/${slug}/regenerate`, {
        sessionToken,
      });
      setReviewText(res.data.reviewText);
      setRemainingGenerations(res.data.remainingGenerations);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError(err.response.data.error || "Maximum regenerations reached.");
        setRemainingGenerations(0);
      } else {
        setError("Failed to regenerate review. Please try again.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const copyReview = async () => {
    try {
      await navigator.clipboard.writeText(reviewText);
      setCopied(true);

      // Mark as copied on backend and get Google review URL
      const res = await axios.post(`${API}/qr-reviews/public/${slug}/copied`, {
        sessionToken,
      });
      setGoogleReviewUrl(res.data.googleReviewUrl);

      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      // Fallback for clipboard API failure
      const textArea = document.createElement("textarea");
      textArea.value = reviewText;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);

      try {
        const res = await axios.post(`${API}/qr-reviews/public/${slug}/copied`, {
          sessionToken,
        });
        setGoogleReviewUrl(res.data.googleReviewUrl);
      } catch {}

      setTimeout(() => setCopied(false), 3000);
    }
  };

  const submitConcern = async () => {
    if (!concernText.trim() || concernText.trim().length < 10) {
      setError("Please provide more detail about your concern.");
      return;
    }

    setSubmittingConcern(true);
    setError(null);
    try {
      const res = await axios.post(`${API}/qr-reviews/public/${slug}/concern`, {
        sessionToken,
        patientName: patientName.trim() || undefined,
        patientContact: patientContact.trim() || undefined,
        concernText: concernText.trim(),
      });
      // Concern endpoint returns googleReviewUrl for optional review link
      if (res.data.googleReviewUrl) {
        setGoogleReviewUrl(res.data.googleReviewUrl);
      }
      setStep("concern_submitted");
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError("Too many submissions. Please try again later.");
      } else {
        setError("Failed to submit. Please try again.");
      }
    } finally {
      setSubmittingConcern(false);
    }
  };

  const openGoogleReview = async () => {
    if (googleReviewUrl) {
      // Track google click on backend
      try {
        await axios.post(`${API}/qr-reviews/public/${slug}/google-clicked`, {
          sessionToken,
        });
      } catch {}
      window.open(googleReviewUrl, "_blank");
    }
  };

  return {
    campaign,
    slug,
    step,
    setStep,
    error,
    setError,

    patientName,
    setPatientName,
    selectedHighlights,
    toggleHighlight,

    // New inputs
    freeText,
    setFreeText,
    staffName,
    setStaffName,
    reviewLength,
    setReviewLength,

    // Chip rules
    chipCount,
    canSelectMore,
    hasEnoughChips,
    maxChips: MAX_CHIPS,
    minChips: MIN_CHIPS,

    goToWhatStoodOut,
    submitHighlightsAndGenerate,
    startConcernFlow,

    reviewText,
    generating,
    remainingGenerations,
    copied,
    googleReviewUrl,
    generateReview,
    regenerateReview,
    copyReview,
    openGoogleReview,

    concernText,
    setConcernText,
    patientContact,
    setPatientContact,
    submittingConcern,
    submitConcern,
  };
};
