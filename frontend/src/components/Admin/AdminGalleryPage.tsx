import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaEnvelope } from 'react-icons/fa';

interface Clinic {
  _id: string;
  name: string;
  email: string;
}

interface GalleryItem {
  _id: string;
  name: string;
  url: string;
  date: string;
}

interface AssignedGalleryItem {
  _id: string;
  clinicId: Clinic | string;
  galleryItemId: GalleryItem | string;
  isCurrent: boolean;
  assignedAt: string;
}

const AdminGalleryPage: React.FC = () => {
  // Master gallery items
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [newItem, setNewItem] = useState({ name: '', url: '' });
  const [editItem, setEditItem] = useState<GalleryItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Clinics and assignments
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<string>('');
  const [clinicAssignments, setClinicAssignments] = useState<AssignedGalleryItem[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Filtering
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [filteredItems, setFilteredItems] = useState<GalleryItem[]>([]);

  // Add state for selected items and modal for clinic selection
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');

  // Email notification state
  const [selectedEmailClinic, setSelectedEmailClinic] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('Gallery Update');
  const [emailBody, setEmailBody] = useState('Hi {clinicName},\n\nWe have updated your gallery with new professional photos.\n\nBest regards,\nCliniMedia Team');
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Generate months for filter (last 12 months)
  const generateMonths = () => {
    const months = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
      const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      months.push({ key: monthKey, label: monthLabel });
    }
    return months;
  };

  const months = generateMonths();

  // Fetch gallery items from backend
  const fetchGalleryItems = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/gallery`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched gallery items:', res.data);
      setGalleryItems(res.data);
    } catch (err) {
      console.error("❌ Failed to fetch gallery items", err);
    }
  };

  // Fetch clinics and assignments
  const fetchClinicsAndAssignments = async () => {
    const token = localStorage.getItem('adminToken');
    console.log('Fetching clinics and assignments with token:', token ? 'present' : 'missing');
    
    try {
      // Fetch clinics (customers)
      const clinicsRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched clinics:', clinicsRes.data);
      setClinics(clinicsRes.data);
      
      // Fetch assignments
      const assignmentsRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/gallery/assignments/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched assignments:', assignmentsRes.data);
      setClinicAssignments(assignmentsRes.data.assignments);
    } catch (error) {
      console.error('Error fetching clinics and assignments:', error);
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = galleryItems;

    // Filter by clinic
    if (selectedClinic) {
      const assignedItemIds = clinicAssignments
        .filter(a => {
          if (typeof a.clinicId === 'string') return a.clinicId === selectedClinic;
          return a.clinicId._id === selectedClinic;
        })
        .map(a => typeof a.galleryItemId === 'string' ? a.galleryItemId : a.galleryItemId._id);
      
      filtered = filtered.filter(item => assignedItemIds.includes(item._id));
    }

    // Filter by month
    if (selectedMonth) {
      const assignedItemIds = clinicAssignments
        .filter(a => {
          const assignmentDate = new Date(a.assignedAt);
          const assignmentMonth = assignmentDate.toISOString().slice(0, 7);
          return assignmentMonth === selectedMonth;
        })
        .map(a => typeof a.galleryItemId === 'string' ? a.galleryItemId : a.galleryItemId._id);
      
      filtered = filtered.filter(item => assignedItemIds.includes(item._id));
    }

    setFilteredItems(filtered);
  }, [galleryItems, clinicAssignments, selectedClinic, selectedMonth]);

  useEffect(() => {
    fetchGalleryItems();
    fetchClinicsAndAssignments();
  }, []);

  // Add new gallery item
  const handleAddItem = async () => {
    if (!newItem.name.trim() || !newItem.url.trim()) return;
    const token = localStorage.getItem('adminToken');
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery`, newItem, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNewItem({ name: '', url: '' });
    setShowItemModal(false);
    fetchGalleryItems();
  };

  // Edit gallery item
  const handleEditItem = async () => {
    if (!editItem || !editItem.name.trim() || !editItem.url.trim()) return;
    const token = localStorage.getItem('adminToken');
    await axios.put(`${import.meta.env.VITE_API_BASE_URL}/gallery/${editItem._id}`, editItem, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setShowEditModal(false);
    setEditItem(null);
    fetchGalleryItems();
  };

  // Delete gallery item
  const handleDeleteItem = async (id: string) => {
    if (!window.confirm('Delete this gallery item?')) return;
    const token = localStorage.getItem('adminToken');
    await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/gallery/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchGalleryItems();
    fetchClinicsAndAssignments();
  };

  // Assign items to clinic
  const handleAssignItems = async () => {
    if (!selectedClinic) return;
    setLoadingAssignments(true);
    const token = localStorage.getItem('adminToken');
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery/assign`, {
      clinicId: selectedClinic,
      galleryItemIds: selectedItems,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setLoadingAssignments(false);
    fetchClinicsAndAssignments();
    setSelectedClinic('');
  };

  // Update assignment status
  const handleUpdateAssignment = async (clinicId: string, galleryItemId: string, isCurrent: boolean) => {
    const token = localStorage.getItem('adminToken');
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery/update-assignment`, {
      clinicId, galleryItemId, isCurrent
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchClinicsAndAssignments();
  };

  // Remove assignment
  const handleRemoveAssignment = async (clinicId: string, galleryItemId: string) => {
    if (!window.confirm('Remove this gallery item from the clinic?')) return;
    const token = localStorage.getItem('adminToken');
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery/remove-assignment`, {
      clinicId, galleryItemId
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchClinicsAndAssignments();
  };

  // Get assignment info for an item
  const getItemAssignments = (itemId: string) => {
    return clinicAssignments.filter(a => {
      const assignmentItemId = typeof a.galleryItemId === 'string' ? a.galleryItemId : a.galleryItemId._id;
      return assignmentItemId === itemId;
    });
  };

  // Get clinic name by ID
  const getClinicName = (clinicId: string) => {
    const clinic = clinics.find(c => c._id === clinicId);
    return clinic ? clinic.name : 'Unknown Clinic';
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
          <h1 className="text-3xl font-bold text-[#303b45]">Gallery Management</h1>
          <button
            onClick={() => setShowItemModal(true)}
            className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7]"
          >
            Add New Item
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#303b45] mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Clinic</label>
              <select
                value={selectedClinic}
                onChange={(e) => setSelectedClinic(e.target.value)}
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
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-[#98c6d5]"
              >
                <option value="">All Months</option>
                {months.map(month => (
                  <option key={month.key} value={month.key}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Combined Gallery Items and Assignments */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-[#303b45] mb-4">Gallery Items & Assignments</h2>
          
          {/* Results Summary */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Showing {filteredItems.length} item(s)
              {selectedClinic && ` for ${clinics.find(c => c._id === selectedClinic)?.name}`}
              {selectedMonth && ` in ${months.find(m => m.key === selectedMonth)?.label}`}
            </p>
          </div>

          {/* Gallery Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-3 px-4"></th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">URL</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Assignment Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No gallery items found with the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
                    const assignments = getItemAssignments(item._id);
                    
                    return (
                      <tr key={item._id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.includes(item._id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedItemIds([...selectedItemIds, item._id]);
                              } else {
                                setSelectedItemIds(selectedItemIds.filter(id => id !== item._id));
                              }
                            }}
                          />
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">{item.name}</td>
                        <td className="py-3 px-4 text-gray-700">
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {item.url.length > 50 ? item.url.substring(0, 50) + '...' : item.url}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          {assignments.length === 0 ? (
                            <span className="text-gray-400 text-sm">Not assigned</span>
                          ) : (
                            <div className="space-y-2">
                              {assignments.map(assignment => {
                                const clinicId = typeof assignment.clinicId === 'string' ? assignment.clinicId : assignment.clinicId._id;
                                const clinicName = getClinicName(clinicId);
                                const status = assignment.isCurrent ? 'Current' : 'History';
                                const statusColor = assignment.isCurrent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
                                const assignmentDate = new Date(assignment.assignedAt);
                                
                                return (
                                  <div key={assignment._id} className="border rounded-lg p-2 bg-gray-50">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-medium text-gray-900">{clinicName}</span>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                        {status}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600 mb-2">
                                      Assigned: {assignmentDate.toLocaleDateString()}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleRemoveAssignment(clinicId, item._id)}
                                        className="text-red-600 hover:text-red-800 text-xs px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                                      >
                                        Remove
                                      </button>
                                      <select
                                        className="border p-1 rounded text-xs text-black"
                                        value={status.toLowerCase()}
                                        onChange={async e => {
                                          const isCurrent = e.target.value === 'current';
                                          await handleUpdateAssignment(clinicId, item._id, isCurrent);
                                        }}
                                      >
                                        <option value="history">Set as History</option>
                                        <option value="current">Set as Current</option>
                                      </select>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => {
                              setEditItem(item);
                              setShowEditModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item._id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Assign Button */}
          {selectedItemIds.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowAssignModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Assign Selected Items ({selectedItemIds.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Add New Gallery Item</h3>
            <select
              value={selectedClinicId}
              onChange={e => setSelectedClinicId(e.target.value)}
              className="w-full p-2 border rounded mb-2 text-black"
              disabled={clinics.length === 0}
            >
              <option value="">
                {clinics.length === 0 ? "Loading clinics..." : "Select a clinic"}
              </option>
              {clinics.map(clinic => (
                <option key={clinic._id} value={clinic._id}>
                  {clinic.name} ({clinic.email})
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Item Name"
              value={newItem.name}
              onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              className="w-full p-2 border rounded mb-2 text-black"
            />
            <div className="mb-2">
              <label className="block text-sm font-medium mb-1 text-black">Upload Image or Enter URL:</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const token = localStorage.getItem('adminToken');
                      const formData = new FormData();
                      formData.append('image', file);
                      formData.append('name', newItem.name || file.name);
                      
                      // Upload image
                      const uploadRes = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery/upload`, formData, {
                        headers: { 
                          Authorization: `Bearer ${token}`,
                          'Content-Type': 'multipart/form-data'
                        },
                      });
                      
                      // Assign to clinic if selected
                      if (selectedClinicId) {
                        await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery/assign`, {
                          clinicId: selectedClinicId,
                          galleryItemIds: [uploadRes.data._id],
                        }, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                      }
                      
                      setNewItem({ name: '', url: '' });
                      setShowItemModal(false);
                      setSelectedClinicId('');
                      fetchGalleryItems();
                      fetchClinicsAndAssignments();
                      alert('✅ Image uploaded successfully!');
                    } catch (error: any) {
                      alert(`❌ Upload failed: ${error.response?.data?.error || error.message}`);
                    }
                  }
                }}
                className="w-full p-2 border rounded text-black"
              />
            </div>
            <p className="text-xs text-gray-500 mb-2 text-center">OR</p>
            <input
              type="url"
              placeholder="Gallery URL (if not uploading file)"
              value={newItem.url}
              onChange={e => setNewItem({ ...newItem, url: e.target.value })}
              className="w-full p-2 border rounded mb-4 text-black"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!newItem.name.trim() || !newItem.url.trim() || !selectedClinicId) return;
                  const token = localStorage.getItem('adminToken');
                  // 1. Create the gallery item
                  const res = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery`, newItem, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  // 2. Assign the new gallery item to the selected clinic
                  await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery/assign`, {
                    clinicId: selectedClinicId,
                    galleryItemIds: [res.data._id],
                  }, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  setNewItem({ name: '', url: '' });
                  setShowItemModal(false);
                  setSelectedClinicId('');
                  fetchGalleryItems();
                  fetchClinicsAndAssignments();
                }}
                className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7]"
                disabled={!selectedClinicId || clinics.length === 0 || (!newItem.url.trim() && !newItem.name.trim())}
              >
                Add URL
              </button>
              <button
                onClick={() => setShowItemModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && editItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Edit Gallery Item</h3>
            <input
              type="text"
              placeholder="Item Name"
              value={editItem.name}
              onChange={e => setEditItem({ ...editItem, name: e.target.value })}
              className="w-full p-2 border rounded mb-2 text-black"
            />
            <input
              type="url"
              placeholder="Gallery URL"
              value={editItem.url}
              onChange={e => setEditItem({ ...editItem, url: e.target.value })}
              className="w-full p-2 border rounded mb-2 text-black"
            />
            <input
              type="date"
              value={editItem.date ? editItem.date.slice(0, 10) : ''}
              onChange={e => setEditItem({ ...editItem, date: e.target.value })}
              className="w-full p-2 border rounded mb-4 text-black"
            />
            <div className="flex gap-2">
              <button
                onClick={handleEditItem}
                className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7]"
              >
                Update
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Assign Gallery Items</h3>
            <select
              value={selectedClinicId}
              onChange={e => setSelectedClinicId(e.target.value)}
              className="w-full p-2 border rounded mb-4 text-black"
            >
              <option value="">Select a clinic</option>
              {clinics.map(clinic => (
                <option key={clinic._id} value={clinic._id}>
                  {clinic.name} ({clinic.email})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7]"
                disabled={!selectedClinicId}
                onClick={async () => {
                  if (!selectedClinicId) return;
                  setShowAssignModal(false);
                  setSelectedClinicId('');
                  const token = localStorage.getItem('adminToken');
                  console.log('Assigning items:', { clinicId: selectedClinicId, galleryItemIds: selectedItemIds });
                  try {
                    const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/gallery/assign`, {
                      clinicId: selectedClinicId,
                      galleryItemIds: selectedItemIds,
                    }, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    console.log('Assignment response:', response.data);
                    setSelectedItemIds([]);
                    fetchClinicsAndAssignments();
                  } catch (error) {
                    console.error('Error assigning items:', error);
                  }
                }}
              >
                Assign
              </button>
              <button
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                onClick={() => setShowAssignModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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