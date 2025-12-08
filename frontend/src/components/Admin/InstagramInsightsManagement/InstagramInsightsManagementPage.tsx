import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaInstagram, FaEnvelope, FaTrash } from 'react-icons/fa';

interface Clinic {
  _id: string;
  name: string;
  email: string;
}

interface InstagramInsightImage {
  _id: string;
  clinicId: Clinic | string;
  month: string;
  imageUrl: string;
  uploadedAt: string;
  url?: string; // Presigned URL from API (Railway Bucket)
}

const InstagramInsightsManagementPage: React.FC = () => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Filter states
  const [filterClinicId, setFilterClinicId] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [images, setImages] = useState<InstagramInsightImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<InstagramInsightImage[]>([]);

  // Email notification state
  const [emailClinics, setEmailClinics] = useState<any[]>([]);
  const [selectedEmailClinic, setSelectedEmailClinic] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('Instagram Insights Update');
  const [emailBody, setEmailBody] = useState('Hi {clinicName},\n\nWe have uploaded your latest Instagram insights report.\n\nBest regards,\nCliniMedia Team');
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Fetch clinics
  const fetchClinics = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinics(res.data);
      setEmailClinics(res.data);
    } catch (err) {
      setClinics([]);
      setEmailClinics([]);
    }
  };

  // Fetch images
  const fetchImages = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      let url = `${import.meta.env.VITE_API_BASE_URL}/instagram-insights/list`;
      const params: any = {};
      if (filterClinicId) params.clinicId = filterClinicId;
      if (filterMonth) params.month = filterMonth;
      const query = new URLSearchParams(params).toString();
      if (query) url += `?${query}`;
      
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setImages(res.data);
      setFilteredImages(res.data);
    } catch (err) {
      setImages([]);
      setFilteredImages([]);
    }
  };

  useEffect(() => {
    fetchClinics();
    fetchImages();
  }, []);

  useEffect(() => {
    fetchImages();
  }, [filterClinicId, filterMonth]);

  // Helper: get month label
  const getMonthLabel = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(Number(year), Number(m) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Get clinic name
  const getClinicName = (clinicId: Clinic | string) => {
    if (typeof clinicId === 'string') {
      const clinic = clinics.find(c => c._id === clinicId);
      return clinic ? clinic.name : 'Unknown Clinic';
    }
    return clinicId.name;
  };

  // Upload image
  const handleUpload = async () => {
    if (!selectedClinicId || !selectedMonth || !imageFile) {
      alert('Please select a customer, month, and image file');
      return;
    }
    
    setLoading(true);
    setUploadSuccess(false);
    
    const token = localStorage.getItem('adminToken');
    const formData = new FormData();
    formData.append('clinicId', selectedClinicId);
    formData.append('month', selectedMonth);
    formData.append('image', imageFile);
    
    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/instagram-insights/upload`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Reset form
      setSelectedClinicId('');
      setSelectedMonth('');
      setImageFile(null);
      setUploadSuccess(true);
      
      // Refresh images list
      fetchImages();
      
      // Clear success message after 3 seconds
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err: any) {
      alert(`Upload failed: ${err.response?.data?.error || err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Delete image
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this Instagram insight image?')) return;
    
    const token = localStorage.getItem('adminToken');
    try {
      await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/instagram-insights/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Refresh images list
      fetchImages();
    } catch (err: any) {
      alert(`Delete failed: ${err.response?.data?.error || err.message || 'Unknown error'}`);
    }
  };

  // Replace image (upload new one for same clinic/month)
  const handleReplace = (image: InstagramInsightImage) => {
    const clinicId = typeof image.clinicId === 'string' ? image.clinicId : image.clinicId._id;
    setSelectedClinicId(clinicId);
    setSelectedMonth(image.month);
    // Scroll to upload form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Send email notification
  const handleSendEmail = async () => {
    if (!selectedEmailClinic) {
      alert('Please select a clinic first');
      return;
    }

    const selectedClinicData = emailClinics.find(c => c._id === selectedEmailClinic);
    if (!selectedClinicData) {
      alert('Selected clinic not found');
      return;
    }

    // Replace clinic name in email body
    const emailBodyWithClinic = emailBody.replace('{clinicName}', selectedClinicData.name);

    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/email-notification-settings/send-custom`, {
        clinicId: selectedEmailClinic,
        subject: emailSubject,
        body: emailBodyWithClinic,
        clinicEmail: selectedClinicData.email
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      alert(`✅ Email sent successfully to ${selectedClinicData.name}`);
      setShowEmailModal(false);
    } catch (error: any) {
      alert(`❌ Failed to send email: ${error.response?.data?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans p-6">
      <div className="max-w-6xl mx-auto">
        {/* Email Notification Section - At Top */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#303b45]">Email Notifications</h2>
            <button
              onClick={() => setShowEmailModal(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <FaEnvelope /> Send Email
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold text-black mb-2">Instagram Insights</h3>
              <p className="text-sm text-gray-700 mb-2">Send custom emails to clinics</p>
              <div className="text-xs text-gray-600">
                <div>Subject: {emailSubject}</div>
                <div>Template: Custom</div>
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <FaInstagram className="text-3xl text-pink-600" />
            <h1 className="text-3xl font-bold text-[#303b45]">Instagram Insights Management</h1>
          </div>
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#303b45] mb-6">Upload Instagram Insights</h2>
          
          {uploadSuccess && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-semibold">✅ Image uploaded successfully!</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Select Customer */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Customer
              </label>
              <select
                value={selectedClinicId}
                onChange={e => setSelectedClinicId(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
              >
                <option value="">Choose a customer...</option>
                {clinics.map(clinic => (
                  <option key={clinic._id} value={clinic._id}>
                    {clinic.name} ({clinic.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Select Month */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Month
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
              />
            </div>

            {/* Upload Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={e => setImageFile(e.target.files?.[0] || null)}
                className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
              />
            </div>
          </div>

          {imageFile && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Selected: <span className="font-semibold">{imageFile.name}</span> ({(imageFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!selectedClinicId || !selectedMonth || !imageFile || loading}
            className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7] disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? 'Uploading...' : 'Upload Image'}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#303b45] mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Clinic</label>
              <select
                value={filterClinicId}
                onChange={(e) => setFilterClinicId(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
              >
                <option value="">All Clinics</option>
                {clinics.map(clinic => (
                  <option key={clinic._id} value={clinic._id}>
                    {clinic.name} ({clinic.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Month</label>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
              />
            </div>
          </div>
        </div>

        {/* Images List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-[#303b45] mb-4">Instagram Insights Images</h2>
          
          {filteredImages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No Instagram insight images found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredImages.map((image) => (
                <div key={image._id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {getClinicName(image.clinicId)}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {getMonthLabel(image.month)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Uploaded: {new Date(image.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <img
                      src={(() => {
                        if (image.url) {
                          return image.url;
                        }
                        if (image.imageUrl.startsWith('http')) {
                          return image.imageUrl;
                        }
                        if (image.imageUrl.startsWith('/uploads/')) {
                          return `${import.meta.env.VITE_BACKEND_BASE_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}${image.imageUrl}`;
                        }
                        return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/instagram-insights/image/${image._id}`;
                      })()}
                      alt={`Instagram Insights - ${getMonthLabel(image.month)}`}
                      className="w-full h-48 object-contain rounded-lg border border-gray-200 bg-white"
                      onError={(e) => {
                        console.error('Admin thumbnail failed to load:', image.imageUrl);
                      }}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReplace(image)}
                      className="flex-1 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => handleDelete(image._id)}
                      className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-2 text-sm font-medium"
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Email Notification Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-black">Send Email Notification</h2>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-black">Select Clinic:</label>
                <select
                  value={selectedEmailClinic}
                  onChange={(e) => setSelectedEmailClinic(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                >
                  <option value="">Choose a clinic...</option>
                  {emailClinics.map(clinic => (
                    <option key={clinic._id} value={clinic._id}>
                      {clinic.name} ({clinic.email})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-black">Email Subject:</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  placeholder="Enter email subject..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-black">Email Body:</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={8}
                  className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
                  placeholder="Enter email body... Use {clinicName} to insert clinic name"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Available variables: {'{clinicName}'} (will be replaced with selected clinic name)
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={!selectedEmailClinic}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstagramInsightsManagementPage;
