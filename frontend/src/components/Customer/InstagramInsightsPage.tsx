import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaInstagram, FaSpinner, FaCalendarAlt, FaExclamationTriangle } from 'react-icons/fa';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

interface InstagramInsightImage {
  _id: string;
  month: string;
  imageUrl: string;
  uploadedAt: string;
  url?: string; // Presigned URL from API (Railway Bucket)
}

const InstagramInsightsPage: React.FC = () => {
  const [images, setImages] = useState<InstagramInsightImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<InstagramInsightImage | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Always use real current date for month calculations
  const now = new Date(Date.now());
  const thisMonth = {
    label: `${format(now, 'MMMM yyyy')}`,
    month: format(now, 'yyyy-MM'),
    start: startOfMonth(now),
    end: endOfMonth(now),
  };
  const lastMonth = {
    label: `${format(subMonths(now, 1), 'MMMM yyyy')}`,
    month: format(subMonths(now, 1), 'yyyy-MM'),
    start: startOfMonth(subMonths(now, 1)),
    end: endOfMonth(subMonths(now, 1)),
  };
  const twoMonthsAgo = {
    label: `${format(subMonths(now, 2), 'MMMM yyyy')}`,
    month: format(subMonths(now, 2), 'yyyy-MM'),
    start: startOfMonth(subMonths(now, 2)),
    end: endOfMonth(subMonths(now, 2)),
  };
  const monthRanges = [thisMonth, lastMonth, twoMonthsAgo];

  useEffect(() => {
    fetchImages();
  }, []);

  // Sync selectedImage when selectedMonth changes
  useEffect(() => {
    if (selectedMonth && images.length > 0) {
      const imageForSelectedMonth = images.find(img => img.month === selectedMonth);
      if (imageForSelectedMonth) {
        setSelectedImage(imageForSelectedMonth);
      } else {
        setSelectedImage(null);
      }
    }
  }, [selectedMonth, images]);

  const fetchImages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/instagram-insights/my-images`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const sortedImages = response.data.sort((a: InstagramInsightImage, b: InstagramInsightImage) => {
        // Sort by month (most recent first), then by upload date
        if (a.month !== b.month) {
          return b.month.localeCompare(a.month);
        }
        return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      });
      
      setImages(sortedImages);
      
      console.log('📊 Fetched images:', sortedImages);
      console.log('📅 Month ranges:', monthRanges.map(r => ({ label: r.label, month: r.month })));
      
      // Auto-select the latest image and match it with the month selector
      if (sortedImages.length > 0) {
        const latestImage = sortedImages[0];
        console.log('✅ Auto-selecting latest image:', latestImage);
        setSelectedImage(latestImage);
        setSelectedMonth(latestImage.month);
      } else {
        // If no images, default to this month but no selected image
        console.log('ℹ️ No images found, defaulting to this month');
        setSelectedMonth(thisMonth.month);
        setSelectedImage(null);
      }
    } catch (err: any) {
      console.error('Error fetching Instagram insight images:', err);
      setError(err.response?.data?.error || 'Failed to fetch Instagram insights');
    } finally {
      setLoading(false);
    }
  };

  const formatMonth = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(Number(year), Number(monthNum) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading Instagram insights...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
            <FaInstagram className="mr-3 text-blue-600" />
            Instagram Insights
          </h1>
          <p className="text-gray-600">
            View your Instagram insights reports from the past 3 months
          </p>
        </div>

        {/* Error Card */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <FaExclamationTriangle className="text-4xl text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Insights</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchImages}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen overflow-x-hidden">
      <div className="w-full mx-auto max-w-full xl:max-w-7xl 2xl:max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
          <FaInstagram className="mr-3 text-blue-600" />
          Instagram Insights
        </h1>
        <p className="text-gray-600">
          View your Instagram insights reports from the past 3 months
        </p>
      </div>

      {/* Month Selector - Top Section */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report History</h3>
          <div className="flex flex-col gap-2">
            {monthRanges.map((range) => {
              const hasImage = images.some(img => img.month === range.month);
              const imageForThisMonth = images.find(img => img.month === range.month);
              const isSelected = selectedMonth === range.month;
              
              return (
                <button
                  key={range.month}
                  className={`text-left px-4 py-3 rounded-lg font-medium border transition-all ${
                    isSelected
                      ? 'bg-blue-100 border-blue-400 text-blue-900'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-blue-50'
                  } ${!hasImage ? 'opacity-60' : ''}`}
                  onClick={() => {
                    console.log('🔘 Month button clicked for:', range.month);
                    console.log('🔘 Image for this month:', imageForThisMonth);
                    // Always set the selected month
                    setSelectedMonth(range.month);
                    // Set image if available
                    if (imageForThisMonth) {
                      setSelectedImage(imageForThisMonth);
                      console.log('✅ Set selected image:', imageForThisMonth);
                    } else {
                      setSelectedImage(null);
                      console.log('❌ No image found for month:', range.month);
                    }
                  }}
                  disabled={loading}
                >
                  <div className="flex items-center justify-between">
                    <span>
                      {range.label} {isSelected && <span className="ml-2 text-xs">(Selected)</span>}
                    </span>
                    {hasImage ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Available</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">No Report</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      {/* Main Content - Large Image Display */}
      {images.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <FaInstagram className="text-6xl text-gray-400 mx-auto mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Instagram Insights Available</h3>
              <p className="text-gray-600 mb-6">
                No Instagram insights images have been uploaded for the past 3 months. Check back later or contact your administrator.
              </p>
              <button
                onClick={fetchImages}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      ) : (() => {
        // Find image for selected month
        const imageForSelectedMonth = selectedMonth ? images.find(img => img.month === selectedMonth) : null;
        
        if (imageForSelectedMonth) {
          // Display the image
          return (
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-3 rounded-lg mr-4">
                    <FaCalendarAlt className="text-2xl text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{formatMonth(selectedMonth!)}</h2>
                    <p className="text-sm text-gray-600">
                      Uploaded: {formatDate(imageForSelectedMonth.uploadedAt)}
                    </p>
                  </div>
                </div>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold border border-green-200">
                  Available
                </span>
              </div>
              
              <div className="mt-6 rounded-lg overflow-hidden border border-gray-200">
                <img
                  src={(() => {
                    // Use presigned URL from API if available (Railway Bucket)
                    if (imageForSelectedMonth.url) {
                      return imageForSelectedMonth.url;
                    }
                    // If it's a full URL (old format), use it directly
                    if (imageForSelectedMonth.imageUrl.startsWith('http')) {
                      return imageForSelectedMonth.imageUrl;
                    }
                    // If it's a local path, use backend URL
                    if (imageForSelectedMonth.imageUrl.startsWith('/uploads/')) {
                      return `${import.meta.env.VITE_BACKEND_BASE_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}${imageForSelectedMonth.imageUrl}`;
                    }
                    // Otherwise, it's an object key (Railway Bucket) - use proxy route to get presigned URL
                    return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/instagram-insights/image/${imageForSelectedMonth._id}`;
                  })()}
                  alt={`Instagram Insights - ${formatMonth(selectedMonth!)}`}
                  className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ 
                    width: '100%', 
                    height: 'auto',
                    display: 'block',
                    maxWidth: '100%',
                    objectFit: 'contain'
                  }}
                  onClick={() => {
                    const imageUrl = (() => {
                      if (imageForSelectedMonth.url) {
                        return imageForSelectedMonth.url;
                      }
                      if (imageForSelectedMonth.imageUrl.startsWith('http')) {
                        return imageForSelectedMonth.imageUrl;
                      }
                      if (imageForSelectedMonth.imageUrl.startsWith('/uploads/')) {
                        return `${import.meta.env.VITE_BACKEND_BASE_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}${imageForSelectedMonth.imageUrl}`;
                      }
                      return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/instagram-insights/image/${imageForSelectedMonth._id}`;
                    })();
                    window.open(imageUrl, '_blank');
                  }}
                  onError={(e) => {
                    console.error('Image failed to load:', imageForSelectedMonth.imageUrl);
                    const fullUrl = `${import.meta.env.VITE_BACKEND_BASE_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}${imageForSelectedMonth.imageUrl}`;
                    console.error('Full URL:', fullUrl);
                    console.error('VITE_BACKEND_BASE_URL:', import.meta.env.VITE_BACKEND_BASE_URL);
                    console.error('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
                  }}
                  onLoad={() => {
                    console.log('✅ Image loaded successfully:', imageForSelectedMonth.imageUrl);
                  }}
                />
              </div>
            </div>
          );
        } else if (selectedMonth) {
          // No image for selected month
          return (
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-center min-h-96">
                <div className="text-center">
                  <FaInstagram className="text-6xl text-gray-400 mx-auto mb-6" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Report Available</h3>
                  <p className="text-gray-600">
                    No insights report available for {formatMonth(selectedMonth)}
                  </p>
                </div>
              </div>
            </div>
          );
        } else {
          // No month selected
          return (
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-center min-h-96">
                <div className="text-center">
                  <FaInstagram className="text-6xl text-gray-400 mx-auto mb-6" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Report Available</h3>
                  <p className="text-gray-600">
                    Select a month from the report history above
                  </p>
                </div>
              </div>
            </div>
          );
        }
      })()}

      {/* Image Modal for Full View */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-6xl max-h-[90vh] overflow-auto">
            <img
              src={(() => {
                if (selectedImage.url) {
                  return selectedImage.url;
                }
                if (selectedImage.imageUrl.startsWith('http')) {
                  return selectedImage.imageUrl;
                }
                if (selectedImage.imageUrl.startsWith('/uploads/')) {
                  return `${import.meta.env.VITE_BACKEND_BASE_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}${selectedImage.imageUrl}`;
                }
                return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/instagram-insights/image/${selectedImage._id}`;
              })()}
              alt={`Instagram Insights - ${formatMonth(selectedImage.month)}`}
              className="w-full h-auto rounded-lg shadow-2xl"
              style={{ minWidth: '100%', maxWidth: 'none' }}
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                console.error('Modal image failed to load:', selectedImage.imageUrl);
                const fullUrl = (() => {
                  if (selectedImage.imageUrl.startsWith('http')) {
                    return selectedImage.imageUrl;
                  }
                  if (selectedImage.imageUrl.startsWith('/uploads/')) {
                    return `${import.meta.env.VITE_BACKEND_BASE_URL || import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000'}${selectedImage.imageUrl}`;
                  }
                  return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'}/api/instagram-insights/image/${selectedImage._id}`;
                })();
                console.error('Full URL:', fullUrl);
              }}
            />
            <div className="text-center mt-4 text-white">
              <p className="text-lg font-semibold">{formatMonth(selectedImage.month)}</p>
              <p className="text-sm text-gray-300">Uploaded: {formatDate(selectedImage.uploadedAt)}</p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default InstagramInsightsPage;
