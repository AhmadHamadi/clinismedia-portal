import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaEnvelope } from 'react-icons/fa';

interface Clinic {
  _id: string;
  name: string;
  email: string;
}

interface CustomerMedia {
  clinicId: string;
  clinicName: string;
  clinicEmail: string;
  mediaName: string;
  mediaUrl: string;
  assignedAt: string;
}

const AdminGalleryPage: React.FC = () => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [customerMedia, setCustomerMedia] = useState<CustomerMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', url: '' });

  // Email notification state
  const [selectedEmailClinic, setSelectedEmailClinic] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('Gallery Update');
  const [emailBody, setEmailBody] = useState('Hi {clinicName},\n\nWe have updated your gallery with new professional photos.\n\nBest regards,\nCliniMedia Team');
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Fetch clinics and their current media
  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('adminToken');
    
    try {
      // Fetch clinics
      const clinicsRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinics(clinicsRes.data);

      // Fetch assignments to get current media for each clinic
      const assignmentsRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/gallery/assignments/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Build customer media list with current assignments
      // ✅ FIXED: Filter out assignments with null/undefined clinicId (deleted customers)
      const validAssignments = (assignmentsRes.data.assignments || []).filter((a: any) => {
        // Safety check: skip assignments where clinicId is null/undefined (deleted customer)
        if (!a.clinicId) return false;
        const clinicId = typeof a.clinicId === 'string' ? a.clinicId : a.clinicId._id;
        return clinicId && clinicId !== null && clinicId !== undefined;
      });
      
      const mediaList: CustomerMedia[] = clinicsRes.data.map((clinic: Clinic) => {
        const currentAssignment = validAssignments.find((a: any) => {
          const clinicId = typeof a.clinicId === 'string' ? a.clinicId : a.clinicId._id;
          return clinicId === clinic._id && a.isCurrent;
        });

        if (currentAssignment) {
          const galleryItem = typeof currentAssignment.galleryItemId === 'string' 
            ? null 
            : currentAssignment.galleryItemId;
          
          // ✅ FIXED: Handle case where galleryItemId might be null (deleted gallery item)
          if (!galleryItem) {
            // Gallery item was deleted, show as not set
            return {
              clinicId: clinic._id,
              clinicName: clinic.name,
              clinicEmail: clinic.email,
              mediaName: '',
              mediaUrl: '',
              assignedAt: ''
            };
          }
          
          return {
            clinicId: clinic._id,
            clinicName: clinic.name,
            clinicEmail: clinic.email,
            mediaName: galleryItem?.name || 'Unnamed',
            mediaUrl: galleryItem?.url || '',
            assignedAt: currentAssignment.assignedAt
          };
        }

        return {
          clinicId: clinic._id,
          clinicName: clinic.name,
          clinicEmail: clinic.email,
          mediaName: '',
          mediaUrl: '',
          assignedAt: ''
        };
      });

      setCustomerMedia(mediaList);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      // Show user-friendly error message
      if (error.response?.status === 401) {
        alert('❌ Authentication failed. Please log in again.');
      } else if (error.response?.status === 403) {
        alert('❌ You do not have permission to access this page.');
      } else {
        alert('❌ Failed to load gallery data. Please refresh the page.');
      }
      // Set empty arrays to prevent crashes
      setClinics([]);
      setCustomerMedia([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update customer media link
  const handleUpdateMedia = async (clinicId: string) => {
    if (!editForm.name.trim() || !editForm.url.trim()) {
      alert('Please enter both name and URL');
      return;
    }

    const token = localStorage.getItem('adminToken');
    
    try {
      // Create or find gallery item
      let galleryItemId: string;
      
      // Check if gallery item with this URL already exists
      const existingItemsRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/gallery`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      let existingItem = existingItemsRes.data.find((item: any) => item.url === editForm.url);
      
      if (existingItem) {
        // Update existing item name if needed
        if (existingItem.name !== editForm.name) {
          await axios.put(`${import.meta.env.VITE_API_BASE_URL}/gallery/${existingItem._id}`, {
            name: editForm.name,
            url: editForm.url
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        galleryItemId = existingItem._id;
      } else {
        // Create new gallery item
        const newItemRes = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery`, {
          name: editForm.name,
          url: editForm.url
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        galleryItemId = newItemRes.data._id;
      }

      // Assign to clinic (this will set all other assignments to not current)
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery/assign`, {
        clinicId: clinicId,
        galleryItemIds: [galleryItemId]
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setEditingId(null);
      setEditForm({ name: '', url: '' });
      fetchData();
      alert('✅ Media link updated successfully!');
    } catch (error: any) {
      console.error('Error updating media:', error);
      alert(`❌ Failed to update: ${error.response?.data?.error || error.message}`);
    }
  };

  // Start editing
  const startEdit = (media: CustomerMedia) => {
    setEditingId(media.clinicId);
    setEditForm({
      name: media.mediaName,
      url: media.mediaUrl
    });
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: '', url: '' });
  };

  // Send email notification
  const handleSendEmail = async () => {
    if (!selectedEmailClinic) {
      alert('Please select a clinic first');
      return;
    }

    const selectedClinicData = clinics.find(c => c._id === selectedEmailClinic);
    if (!selectedClinicData) {
      alert('Selected clinic not found');
      return;
    }

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

  if (loading) {
    return <div className="p-6 text-gray-600">Loading...</div>;
  }

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
              <h3 className="font-semibold text-black mb-2">Gallery Updates</h3>
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
          <h1 className="text-3xl font-bold text-[#303b45]">Manage Customer Media Links</h1>
        </div>

        {/* Customer Media Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-[#303b45] mb-4">Customer Media Links</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-3 px-4">Clinic Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Media Name</th>
                  <th className="py-3 px-4">Media URL</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customerMedia.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  customerMedia.map((media) => (
                    <tr key={media.clinicId} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{media.clinicName}</td>
                      <td className="py-3 px-4 text-gray-700">{media.clinicEmail}</td>
                      {editingId === media.clinicId ? (
                        <>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              placeholder="Media Name"
                              className="w-full p-2 border rounded text-black"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="url"
                              value={editForm.url}
                              onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                              placeholder="Media URL"
                              className="w-full p-2 border rounded text-black"
                            />
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-sm">
                            {media.assignedAt ? new Date(media.assignedAt).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleUpdateMedia(media.clinicId)}
                                className="text-green-600 hover:text-green-800 text-sm font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-gray-700">
                            {media.mediaName || <span className="text-gray-400 italic">Not set</span>}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {media.mediaUrl ? (
                              <a 
                                href={media.mediaUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-600 hover:underline"
                              >
                                {media.mediaUrl.length > 40 ? media.mediaUrl.substring(0, 40) + '...' : media.mediaUrl}
                              </a>
                            ) : (
                              <span className="text-gray-400 italic">Not set</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-sm">
                            {media.assignedAt ? new Date(media.assignedAt).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => startEdit(media)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              {media.mediaUrl ? 'Edit' : 'Set Link'}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                  {clinics.map(clinic => (
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

export default AdminGalleryPage;
