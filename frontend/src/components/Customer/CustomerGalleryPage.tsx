import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';

interface GalleryItem {
  _id: string;
  name: string;
  url: string;
  date: string;
}

interface AssignedGalleryItem {
  _id: string;
  galleryItemId: GalleryItem;
  isCurrent: boolean;
  assignedAt: string;
}

const DecorativeSparkle = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 animate-pulse">
    <path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/>
  </svg>
);

const CustomerGalleryPage: React.FC = () => {
  const [assignedItems, setAssignedItems] = useState<AssignedGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentItem, setCurrentItem] = useState<AssignedGalleryItem | null>(null);
  const [historyItems, setHistoryItems] = useState<AssignedGalleryItem[]>([]);

  useEffect(() => {
    const fetchAssignedItems = async () => {
      setLoading(true);
      const token = localStorage.getItem('customerToken');
      const userStr = localStorage.getItem('customerData');
      if (!userStr) {
        console.error('No customer data found in localStorage');
        setLoading(false);
        return;
      }
      const user = JSON.parse(userStr);
      const clinicId = user.id || user._id;
      console.log('Fetching gallery items for clinic:', clinicId);
      try {
        const res = await axios.get(`${API_BASE_URL}/gallery/assigned/${clinicId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Received assigned gallery items:', res.data);
        setAssignedItems(res.data);
        
        // Separate current and history items
        const current = res.data.find((item: AssignedGalleryItem) => item.isCurrent);
        const history = res.data.filter((item: AssignedGalleryItem) => !item.isCurrent);
        
        setCurrentItem(current || null);
        setHistoryItems(history);
      } catch (err) {
        console.error('Error fetching assigned gallery items:', err);
        setAssignedItems([]);
        setCurrentItem(null);
        setHistoryItems([]);
      }
      setLoading(false);
    };
    fetchAssignedItems();
  }, []);

  if (loading) return <div className="p-6 text-gray-600">Loading media items...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      {/* Left: Current Gallery Item */}
      <div className="w-full lg:w-2/3">
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-2 py-8 bg-gradient-to-br from-[#f8fafc] to-[#e0f2fe]">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center border border-[#e0e7ef] relative">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                Latest Media
              </span>
            </div>
            <div className="absolute top-6 right-6 opacity-20 rotate-12">
              <DecorativeSparkle />
            </div>
            <div className="absolute bottom-6 left-6 opacity-10 -rotate-12">
              <DecorativeSparkle />
            </div>
            <DecorativeSparkle />
            
            {currentItem ? (
              <>
                <h1 className="text-3xl font-extrabold text-[#60a5fa] mb-2 tracking-tight text-center font-sans">
                  {currentItem.galleryItemId.name}
                </h1>
                <p className="text-gray-600 text-center mb-6 max-w-md font-medium">
                  Explore your latest media day highlights and share your favorite moments with your team. 
                  This media was assigned on {new Date(currentItem.assignedAt).toLocaleDateString()}.
                </p>
                <a
                  href={currentItem.galleryItemId.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 px-8 py-3 bg-[#98c6d5] text-white rounded-xl font-bold text-lg shadow-lg hover:bg-[#1877f3] hover:scale-105 transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-[#98c6d5]/40"
                >
                  <span className="inline-block align-middle mr-2">🔗</span> View Current Media
                </a>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-extrabold text-[#60a5fa] mb-2 tracking-tight text-center font-sans">
                  No Current Media
                </h1>
                <p className="text-gray-600 text-center mb-6 max-w-md font-medium">
                  No media has been assigned to you yet. Check back later or contact your administrator.
                </p>
                <div className="mt-2 px-8 py-3 bg-gray-300 text-gray-600 rounded-xl font-bold text-lg">
                  <span className="inline-block align-middle mr-2">⏳</span> Awaiting Assignment
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: History/Recent Gallery Items */}
      <div className="w-full lg:w-1/3">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-[#303b45] mb-4">Media History</h2>
          {historyItems.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No previous media items found.</p>
          ) : (
            <div className="space-y-3">
              {historyItems.map((item) => (
                <div key={item._id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-1">
                    {item.galleryItemId.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Assigned: {new Date(item.assignedAt).toLocaleDateString()}
                  </p>
                  <a
                    href={item.galleryItemId.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View Media →
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerGalleryPage; 