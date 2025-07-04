import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/api';

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
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [clinicAssignments, setClinicAssignments] = useState<AssignedGalleryItem[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Add state for selected items and modal for clinic selection
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');

  // Fetch gallery items from backend
  const fetchGalleryItems = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_BASE_URL}/gallery`, {
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
      const clinicsRes = await axios.get(`${API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched clinics:', clinicsRes.data);
      setClinics(clinicsRes.data);
      
      // Fetch assignments
      const assignmentsRes = await axios.get(`${API_BASE_URL}/gallery/assignments/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Fetched assignments:', assignmentsRes.data);
      setClinicAssignments(assignmentsRes.data.assignments);
    } catch (error) {
      console.error('Error fetching clinics and assignments:', error);
    }
  };

  useEffect(() => {
    fetchGalleryItems();
    fetchClinicsAndAssignments();
  }, []);

  // Add new gallery item
  const handleAddItem = async () => {
    if (!newItem.name.trim() || !newItem.url.trim()) return;
    const token = localStorage.getItem('adminToken');
    await axios.post(`${API_BASE_URL}/gallery`, newItem, {
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
    await axios.put(`${API_BASE_URL}/gallery/${editItem._id}`, editItem, {
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
    await axios.delete(`${API_BASE_URL}/gallery/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchGalleryItems();
    fetchClinicsAndAssignments();
  };

  // Select a clinic to assign items
  const handleSelectClinic = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    // Find assigned items for this clinic
    const assigned = clinicAssignments.filter(a => {
      if (typeof a.clinicId === 'string') return a.clinicId === clinic._id;
      return a.clinicId._id === clinic._id;
    });
    setSelectedItems(assigned.map(a => typeof a.galleryItemId === 'string' ? a.galleryItemId : a.galleryItemId._id));
  };

  // Assign items to clinic
  const handleAssignItems = async () => {
    if (!selectedClinic) return;
    setLoadingAssignments(true);
    const token = localStorage.getItem('adminToken');
    await axios.post(`${API_BASE_URL}/gallery/assign`, {
      clinicId: selectedClinic._id,
      galleryItemIds: selectedItems,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setLoadingAssignments(false);
    fetchClinicsAndAssignments();
    setSelectedClinic(null);
  };

  // Update assignment status
  const handleUpdateAssignment = async (clinicId: string, galleryItemId: string, isCurrent: boolean) => {
    const token = localStorage.getItem('adminToken');
    await axios.post(`${API_BASE_URL}/gallery/update-assignment`, {
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
    await axios.post(`${API_BASE_URL}/gallery/remove-assignment`, {
      clinicId, galleryItemId
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchClinicsAndAssignments();
  };

  const getAssignmentStatus = (a: any) => a.isCurrent ? 'current' : 'history';

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 font-sans gap-6 p-6">
      {/* Left: Master Gallery Items List */}
      <div className="w-full md:w-2/3 bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-[#303b45]">Gallery Items</h1>
          <button
            onClick={() => setShowItemModal(true)}
            className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7]"
          >
            Add New Item
          </button>
        </div>

        {/* Gallery Items Table */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2"></th>
                <th className="py-2">Name</th>
                <th className="py-2">URL</th>
                <th className="py-2">Date</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {galleryItems.map(item => (
                <tr key={item._id} className="border-b hover:bg-gray-50">
                  <td className="py-2">
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
                  <td className="py-2 font-medium text-gray-900">{item.name}</td>
                  <td className="py-2 text-gray-700">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {item.url.length > 50 ? item.url.substring(0, 50) + '...' : item.url}
                    </a>
                  </td>
                  <td className="py-2 text-gray-700">{new Date(item.date).toLocaleDateString()}</td>
                  <td className="py-2">
                    <button
                      onClick={() => {
                        setEditItem(item);
                        setShowEditModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 mr-2"
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
              ))}
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

      {/* Right: Clinic Assignments */}
      <div className="w-full md:w-1/3 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-[#303b45] mb-4">Clinic Assignments</h2>
        
        {/* Clinic Selection */}
        <div className="mb-4">
          <select
            value={selectedClinic?._id || ''}
            onChange={(e) => {
              const clinic = clinics.find(c => c._id === e.target.value);
              handleSelectClinic(clinic!);
            }}
            className="w-full p-2 border rounded text-black"
          >
            <option value="">Select a clinic</option>
            {clinics.map(clinic => (
              <option key={clinic._id} value={clinic._id}>
                {clinic.name} ({clinic.email})
              </option>
            ))}
          </select>
        </div>

        {/* Selected Clinic Assignments */}
        {selectedClinic && (
          <div>
            <h3 className="font-semibold mb-2">{selectedClinic.name}</h3>
            <ul className="space-y-2">
              {clinicAssignments
                .filter(a => {
                  if (typeof a.clinicId === 'string') return a.clinicId === selectedClinic._id;
                  return a.clinicId._id === selectedClinic._id;
                })
                .map(a => {
                  const item = typeof a.galleryItemId === 'string' ? null : a.galleryItemId;
                  if (!item) return null;
                  
                  const status = getAssignmentStatus(a);
                  let statusColor = 'text-gray-500';
                  if (status === 'current') statusColor = 'text-green-600';
                  
                  return (
                    <li key={a._id} className="flex flex-col md:flex-row md:items-center gap-2 border-b pb-2">
                      <div className="flex-1">
                        <div className="font-medium text-black">{item.name}</div>
                        <div className="text-xs text-[#98c6d5]">{new Date(a.assignedAt).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="border p-1 rounded text-black text-xs"
                          value={status}
                          onChange={async e => {
                            const isCurrent = e.target.value === 'current';
                            await handleUpdateAssignment(selectedClinic._id, item._id, isCurrent);
                          }}
                        >
                          <option value="history">History</option>
                          <option value="current">Current</option>
                        </select>
                        <button
                          onClick={() => handleRemoveAssignment(selectedClinic._id, item._id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
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
            <input
              type="url"
              placeholder="Gallery URL"
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
                  const res = await axios.post(`${API_BASE_URL}/gallery`, newItem, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  // 2. Assign the new gallery item to the selected clinic
                  await axios.post(`${API_BASE_URL}/gallery/assign`, {
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
                disabled={!selectedClinicId || clinics.length === 0}
              >
                Add
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
                    const response = await axios.post(`${API_BASE_URL}/gallery/assign`, {
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
    </div>
  );
};

export default AdminGalleryPage;