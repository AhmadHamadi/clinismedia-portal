import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface InstagramInsightImage {
  _id: string;
  month: string;
  imageUrl: string;
  uploadedAt: string;
}

const InstagramInsightsImagePage: React.FC = () => {
  const [images, setImages] = useState<InstagramInsightImage[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      setLoading(true);
      const token = localStorage.getItem('customerToken');
      const userStr = localStorage.getItem('customerData');
      if (!userStr) {
        setLoading(false);
        return;
      }
      const user = JSON.parse(userStr);
      const clinicId = user.id || user._id;
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/instagram-insights/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setImages(res.data);
        // Default to most recent month if available
        if (res.data.length > 0) {
          const sorted = [...res.data].sort((a, b) => b.month.localeCompare(a.month));
          setSelectedMonth(sorted[0].month);
        }
      } catch (err) {
        setImages([]);
      }
      setLoading(false);
    };
    fetchImages();
  }, []);

  const months = Array.from(new Set(images.map(img => img.month))).sort((a, b) => b.localeCompare(a));
  const selectedImage = images.find(img => img.month === selectedMonth);

  // Helper: get month label
  const getMonthLabel = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(Number(year), Number(m) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  if (loading) return <div className="p-6 text-gray-600">Loading Instagram insights...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      {/* Left: Image Display */}
      <div className="w-full lg:w-3/4 flex flex-col items-center justify-center min-h-[70vh] px-2 py-8 bg-gradient-to-br from-[#f8fafc] to-[#fce4ec]">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-12 flex flex-col items-center border border-[#fce4ec] relative">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
            <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
              Latest Insights
            </span>
          </div>
          {selectedImage ? (
            <>
              <h1 className="text-4xl font-extrabold text-pink-600 mb-4 tracking-tight text-center font-sans">
                {getMonthLabel(selectedImage.month)} Instagram Insights
              </h1>
              <img
                src={`${import.meta.env.VITE_BACKEND_BASE_URL}${selectedImage.imageUrl}`}
                alt="Instagram Insights"
                className="max-w-full max-h-[80vh] rounded shadow-lg mb-6"
              />
              <p className="text-gray-600 text-center mb-2 max-w-md font-medium">
                Uploaded on {new Date(selectedImage.uploadedAt).toLocaleDateString()}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-extrabold text-pink-600 mb-4 tracking-tight text-center font-sans">
                No Insights for Selected Month
              </h1>
              <p className="text-gray-600 text-center mb-6 max-w-md font-medium">
                No Instagram insights image has been uploaded for this month. Check back later or contact your administrator.
              </p>
            </>
          )}
        </div>
      </div>
      {/* Right: Month Selector */}
      <div className="w-full lg:w-1/4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-[#303b45] mb-4">Instagram Insights History</h2>
          {months.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No Instagram insights found.</p>
          ) : (
            <div className="space-y-3">
              {months.map(month => (
                <button
                  key={month}
                  className={`w-full text-left px-4 py-2 rounded-lg font-medium border transition-all ${selectedMonth === month ? 'bg-pink-100 border-pink-400 text-pink-900' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-pink-50'}`}
                  onClick={() => setSelectedMonth(month)}
                >
                  {getMonthLabel(month)} {selectedMonth === month && <span className="ml-2 text-xs">(Selected)</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstagramInsightsImagePage; 