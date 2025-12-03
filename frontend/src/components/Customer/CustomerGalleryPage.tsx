import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaImages, FaExternalLinkAlt, FaSpinner, FaExclamationTriangle, FaPhotoVideo } from 'react-icons/fa';

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

const CustomerGalleryPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [currentItem, setCurrentItem] = useState<AssignedGalleryItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssignedItems = async () => {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('customerToken');
      const userStr = localStorage.getItem('customerData');
      if (!userStr) {
        console.error('No customer data found in localStorage');
        setError('Unable to load customer information');
        setLoading(false);
        return;
      }
      const user = JSON.parse(userStr);
      const clinicId = user.id || user._id;
      console.log('Fetching gallery items for clinic:', clinicId);
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/gallery/assigned/${clinicId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Received assigned gallery items:', res.data);
        
        // Find current item (only one active link)
        const current = res.data.find((item: AssignedGalleryItem) => item.isCurrent);
        
        setCurrentItem(current || null);
      } catch (err: any) {
        console.error('Error fetching assigned gallery items:', err);
        setError(err.response?.data?.error || 'Failed to load media information');
        setCurrentItem(null);
      }
      setLoading(false);
    };
    fetchAssignedItems();
  }, []);

  const openMediaLink = () => {
    if (currentItem?.galleryItemId.url) {
      let url = currentItem.galleryItemId.url;
      
      // If it's an uploaded image, construct full URL
      if (url.startsWith('/uploads/')) {
        url = `${import.meta.env.VITE_BACKEND_BASE_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}${url}`;
      }
      
      // If it doesn't start with http:// or https://, add https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading media information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <FaExclamationTriangle className="text-4xl text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Media</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
            <FaImages className="mr-3 text-blue-600" />
            View Media
          </h1>
          <p className="text-gray-600">
            Access your latest media content and professional photos
          </p>
        </div>

        {/* No Media Card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <FaPhotoVideo className="text-6xl text-gray-400 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Media Available</h3>
              <p className="text-gray-600 mb-6">
                No media has been assigned to you yet. Check back later or contact your administrator if you have questions.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
          <FaImages className="mr-3 text-blue-600" />
          View Media
        </h1>
        <p className="text-gray-600">
          Access your latest media content and professional photos
        </p>
      </div>

      {/* Media Information Card */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg mr-4">
              <FaPhotoVideo className="text-2xl text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{currentItem.galleryItemId.name}</h3>
              <p className="text-gray-600">
                Updated {new Date(currentItem.assignedAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
          {!currentItem.galleryItemId.url.startsWith('/uploads/') && (
            <button
              onClick={openMediaLink}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FaExternalLinkAlt className="mr-2" />
              View Media
            </button>
          )}
        </div>

        {/* Media Content */}
        <div className="mt-6">
          {currentItem.galleryItemId.url.startsWith('/uploads/') ? (
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <img
                src={`${import.meta.env.VITE_BACKEND_BASE_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}${currentItem.galleryItemId.url}`}
                alt={currentItem.galleryItemId.name}
                className="w-full h-auto"
              />
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg p-6 bg-gradient-to-br from-gray-50 to-white">
              <div className="text-center">
                <p className="text-gray-700 mb-4">
                  Click the button above to view your media content in a new window.
                </p>
                <div className="bg-gray-100 rounded-lg p-4">
                  <p className="text-sm text-gray-600 font-mono break-all">
                    {currentItem.galleryItemId.url}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Information Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">About Your Media</h3>
        <div className="space-y-3 text-blue-800">
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">1</span>
            <p><strong>Latest Content:</strong> This is your most recent media assignment from our team</p>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">2</span>
            <p><strong>Professional Photos:</strong> High-quality images captured during your media day</p>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">3</span>
            <p><strong>Share & Use:</strong> Download and use these images for your marketing materials</p>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">4</span>
            <p><strong>Questions?</strong> Contact your administrator if you need assistance or have questions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerGalleryPage;
