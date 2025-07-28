import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, BACKEND_BASE_URL } from '../../utils/api';

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

  // Fetch clinics
  const fetchClinics = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const res = await axios.get(`${API_BASE_URL}/customers`, {
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
    let url = `${API_BASE_URL}/instagram-insights/list`;
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

  useEffect(() => {
    fetchClinics();
    fetchImages();
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
      await axios.post(`${API_BASE_URL}/instagram-insights/upload`, formData, {
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
    await axios.delete(`${API_BASE_URL}/instagram-insights/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchImages();
  };

  // Helper: get month label
  const getMonthLabel = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(Number(year), Number(m) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 font-sans gap-6 p-6">
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
                  src={BACKEND_BASE_URL + img.imageUrl}
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
    </div>
  );
};

export default AdminInstagramInsightsPage; 