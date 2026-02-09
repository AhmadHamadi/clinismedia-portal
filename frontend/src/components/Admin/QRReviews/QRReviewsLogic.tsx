import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_BASE_URL;

export interface ChipData {
  label: string;
  category: "staff" | "clinic" | "process" | "provider" | "service";
  sentences: string[];
}

export interface Campaign {
  _id: string;
  customerId?: {
    _id: string;
    name: string;
    email: string;
    clinicName?: string;
  };
  slug: string;
  clinicName: string;
  googleReviewUrl: string;
  isActive: boolean;
  experienceHighlights: ChipData[];
  adminEmail?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
  stats?: {
    sessionCount: number;
    copiedCount: number;
    concernCount: number;
  };
}

export interface CampaignFormData {
  customerId?: string;
  slug: string;
  clinicName: string;
  googleReviewUrl: string;
  isActive: boolean;
  experienceHighlights: ChipData[];
  adminEmail: string;
  logoUrl: string;
}

export interface Concern {
  _id: string;
  campaignId: string;
  patientName?: string;
  patientContact?: string;
  concernText: string;
  status: "new" | "reviewed" | "resolved";
  createdAt: string;
  reviewedAt?: string;
}

export interface CampaignStats {
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

export interface Customer {
  _id: string;
  name: string;
  email: string;
  clinicName?: string;
  customerSettings?: {
    logoUrl?: string;
  };
}

const getToken = () => localStorage.getItem("adminToken");

export const useQRReviews = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showConcerns, setShowConcerns] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [concerns, setConcerns] = useState<Concern[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  // QR code
  const [qrData, setQrData] = useState<{ qrCodeData: string; format: string; url: string } | null>(null);
  const [showQR, setShowQR] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCampaigns();
    fetchCustomers();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/qr-reviews/campaigns`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setCampaigns(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch campaigns");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API}/customers`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setCustomers(res.data);
    } catch (err) {
      console.error("Failed to fetch customers", err);
    }
  };

  const createCampaign = async (data: CampaignFormData) => {
    setSaving(true);
    setError(null);
    try {
      await axios.post(`${API}/qr-reviews/campaigns`, data, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setShowForm(false);
      await fetchCampaigns();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  };

  const updateCampaign = async (id: string, data: CampaignFormData) => {
    setSaving(true);
    setError(null);
    try {
      await axios.put(`${API}/qr-reviews/campaigns/${id}`, data, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setShowForm(false);
      setEditingCampaign(null);
      await fetchCampaigns();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update campaign");
    } finally {
      setSaving(false);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!window.confirm("Are you sure? This will delete the campaign and all related data.")) return;
    try {
      await axios.delete(`${API}/qr-reviews/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await fetchCampaigns();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete campaign");
    }
  };

  const fetchConcerns = async (campaignId: string) => {
    try {
      const res = await axios.get(`${API}/qr-reviews/campaigns/${campaignId}/concerns`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setConcerns(res.data);
      setSelectedCampaignId(campaignId);
      setShowConcerns(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch concerns");
    }
  };

  const updateConcernStatus = async (campaignId: string, concernId: string, status: string) => {
    try {
      await axios.put(
        `${API}/qr-reviews/campaigns/${campaignId}/concerns/${concernId}`,
        { status },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      // Refresh concerns list
      await fetchConcerns(campaignId);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update concern");
    }
  };

  const fetchStats = async (campaignId: string) => {
    try {
      const res = await axios.get(`${API}/qr-reviews/campaigns/${campaignId}/stats`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setStats(res.data);
      setSelectedCampaignId(campaignId);
      setShowStats(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to fetch stats");
    }
  };

  const fetchQRCode = async (campaignId: string, format: "png" | "svg" = "png") => {
    try {
      const res = await axios.get(`${API}/qr-reviews/campaigns/${campaignId}/qr-code?format=${format}&size=400`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      setQrData(res.data);
      setSelectedCampaignId(campaignId);
      setShowQR(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to generate QR code");
    }
  };

  const downloadQR = (format: "png" | "svg") => {
    if (!qrData) return;

    if (format === "svg") {
      const blob = new Blob([qrData.qrCodeData], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-review-${selectedCampaignId}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const a = document.createElement("a");
      a.href = qrData.qrCodeData;
      a.download = `qr-review-${selectedCampaignId}.png`;
      a.click();
    }
  };

  const openEditForm = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setShowForm(true);
  };

  const openCreateForm = () => {
    setEditingCampaign(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCampaign(null);
  };

  return {
    campaigns,
    customers,
    loading,
    error,
    setError,
    saving,

    // CRUD
    createCampaign,
    updateCampaign,
    deleteCampaign,
    fetchCampaigns,

    // Form modal
    showForm,
    editingCampaign,
    openCreateForm,
    openEditForm,
    closeForm,

    // Concerns
    showConcerns,
    setShowConcerns,
    concerns,
    selectedCampaignId,
    fetchConcerns,
    updateConcernStatus,

    // Stats
    showStats,
    setShowStats,
    stats,
    fetchStats,

    // QR
    showQR,
    setShowQR,
    qrData,
    fetchQRCode,
    downloadQR,
  };
};
