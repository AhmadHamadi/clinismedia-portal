import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaEnvelope } from 'react-icons/fa';

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
}

const AdminInstagramInsightsPage: React.FC = () => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [images, setImages] = useState<InstagramInsightImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterClinicId, setFilterClinicId] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // Email notification state
  const [emailClinics, setEmailClinics] = useState<any[]>([]);
  const [selectedEmailClinic, setSelectedEmailClinic] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('Instagram Insights Update');
  const [emailBody, setEmailBody] = useState('Hi {clinicName},\n\nWe have uploaded your latest Instagram insights report.\n\nBest regards,\nCliniMedia Team');
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Generate months for selection
  const months = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  // Generate years for selection (last 5 years)
  const years = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return { value: year.toString(), label: year.toString() };
  });

  // Fetch clinics
  const fetchClinics = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinics(res.data);
    } catch (err) {
      setClinics([]);
    }
  };

  // Fetch images
  const fetchImages = async () => {
    const token = localStorage.getItem('adminToken');
    let url = `${import.meta.env.VITE_API_BASE_URL}/instagram-insights/list`;
    const params: any = {};
    if (filterClinicId) params.clinicId = filterClinicId;
    if (filterMonth) params.month = filterMonth;
    const query = new URLSearchParams(params).toString();
    if (query) url += `?${query}`;
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setImages(res.data);
    } catch (err) {
      setImages([]);
    }
  };

  // Fetch clinics for email functionality
  const fetchEmailClinics = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmailClinics(response.data);
    } catch (error) {
      console.error('Error fetching clinics for email:', error);
    }
  };

  useEffect(() => {
    fetchClinics();
    fetchImages();
    fetchEmailClinics(); // Fetch clinics for email functionality
  }, []);

  useEffect(() => {
    fetchImages();
  }, [filterClinicId, filterMonth]);

  // Upload image
  const handleUpload = async () => {
    if (!selectedClinicId || !selectedMonth || !imageFile) return;
    setLoading(true);
    const token = localStorage.getItem('adminToken');
    const formData = new FormData();
    formData.append('clinicId', selectedClinicId);
    formData.append('month', selectedMonth);
    formData.append('image', imageFile);
    try {
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/instagram-insights/upload`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedClinicId('');
      setSelectedMonth('');
      setImageFile(null);
      fetchImages();
    } catch (err) {
      // Optionally show error
    }
    setLoading(false);
  };

  // Delete image
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this Instagram insight image?')) return;
    const token = localStorage.getItem('adminToken');
    await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/instagram-insights/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchImages();
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

  // Helper: get month label
  const getMonthLabel = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(Number(year), Number(m) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 font-sans gap-6 p-6">
      {/* Email Notification Section - At Top */}
      <div className="w-full bg-white rounded-lg shadow-md p-6">
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

      {/* Upload Form */}
      <div className="w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-[#303b45] mb-4">Instagram Insights (Upload)</h1>
        <select
          value={selectedClinicId}
          onChange={e => setSelectedClinicId(e.target.value)}
          className="w-full p-2 border rounded text-black mb-2"
        >
          <option value="">Select a clinic</option>
          {clinics.map(clinic => (
            <option key={clinic._id} value={clinic._id}>
              {clinic.name} ({clinic.email})
            </option>
          ))}
        </select>
        <input
          type="month"
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="w-full p-2 border rounded mb-2 text-black"
        />
        <input
          type="file"
          accept="image/*"
          onChange={e => setImageFile(e.target.files?.[0] || null)}
          className="w-full p-2 border rounded mb-4 text-black"
        />
        <button
          onClick={handleUpload}
          className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7] w-full"
          disabled={!selectedClinicId || !selectedMonth || !imageFile || loading}
        >
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      {/* Image List & Filter */}
      <div className="w-full bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <select
            value={filterClinicId}
            onChange={e => setFilterClinicId(e.target.value)}
            className="p-2 border rounded text-black"
          >
            <option value="">All clinics</option>
            {clinics.map(clinic => (
              <option key={clinic._id} value={clinic._id}>
                {clinic.name}
              </option>
            ))}
          </select>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="p-2 border rounded text-black"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {images.length === 0 ? (
            <p className="text-gray-500 col-span-2">No Instagram insight images found.</p>
          ) : (
            images.map(img => (
              <div key={img._id} className="border rounded-lg p-4 flex flex-col items-center bg-gray-50">
                <div className="mb-2 text-sm text-gray-700 font-semibold">
                  {typeof img.clinicId === 'string'
                    ? clinics.find(c => c._id === img.clinicId)?.name || 'Clinic'
                    : img.clinicId.name}
                  {' • '}
                  {getMonthLabel(img.month)}
                </div>
                <img
                  src={import.meta.env.VITE_BACKEND_BASE_URL + img.imageUrl}
                  alt="Instagram Insight"
                  className="max-w-full max-h-64 rounded shadow mb-2"
                />
                <button
                  onClick={() => handleDelete(img._id)}
                  className="mt-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-700 text-xs"
                >
                  Delete
                </button>
              </div>
            ))
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

export default AdminInstagramInsightsPage; 