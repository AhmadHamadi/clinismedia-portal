import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaFolder, FaExternalLinkAlt, FaCheckCircle, FaTimesCircle, FaSpinner, FaSyncAlt, FaBell, FaStickyNote, FaEye, FaEyeSlash, FaTrash } from 'react-icons/fa';

interface Customer {
  _id: string;
  name: string;
  email: string;
  location?: string;
  sharedFolderLink?: string;
  sharedFolderName?: string;
}

interface ClientNote {
  _id: string;
  customerId: string;
  customerName: string;
  note: string;
  createdAt: string;
  expiresAt: string;
  isRead: boolean;
  readAt?: string;
}

const SharedFolderManagementPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedFolders, setSelectedFolders] = useState<{ [customerId: string]: string }>({});
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    fetchCustomers();
    fetchUnreadNotesCount();
  }, []);

  const fetchNotes = async () => {
    try {
      setNotesLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/client-notes/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotes(response.data.notes);
    } catch (err: any) {
      console.error('Failed to fetch notes', err);
      setError('Failed to fetch client notes');
    } finally {
      setNotesLoading(false);
    }
  };

  const markNoteAsRead = async (noteId: string) => {
    try {
      const token = localStorage.getItem('adminToken');
      await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/client-notes/mark-read/${noteId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setNotes(prev => prev.map(note => 
        note._id === noteId ? { ...note, isRead: true, readAt: new Date().toISOString() } : note
      ));
      setUnreadNotesCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Failed to mark note as read', err);
    }
  };

  const markAllNotesAsRead = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/client-notes/mark-all-read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      setNotes(prev => prev.map(note => ({ ...note, isRead: true, readAt: new Date().toISOString() })));
      setUnreadNotesCount(0);
    } catch (err: any) {
      console.error('Failed to mark all notes as read', err);
    }
  };

  const fetchUnreadNotesCount = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/client-notes/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadNotesCount(response.data.count);
    } catch (err: any) {
      console.error('Failed to fetch unread notes count', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/shared-folders/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data);
    } catch (err) {
      console.error('Failed to fetch customers', err);
      setError('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignFolder = async (customer: Customer, folderLink: string) => {
    if (!folderLink.trim()) {
      setError('Please enter a valid folder link');
      return;
    }

    // Validate and format URL
    let validatedLink = folderLink.trim();
    if (!validatedLink.startsWith('http://') && !validatedLink.startsWith('https://')) {
      validatedLink = `https://${validatedLink}`;
    }

    setAssigning(customer._id);
    setSelectedFolders(prev => ({ ...prev, [customer._id]: folderLink }));

    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/shared-folders/assign`, {
        customerId: customer._id,
        folderLink: validatedLink,
        folderName: `${customer.name} - Shared Folder`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(`Shared folder assigned to ${customer.name} successfully!`);
      setTimeout(() => setSuccess(null), 5000);
      fetchCustomers();
    } catch (err: any) {
      console.error('Failed to assign shared folder', err);
      setError(err.response?.data?.error || 'Failed to assign shared folder');
    } finally {
      setAssigning(null);
    }
  };

  const handleRemoveFolder = async (customer: Customer) => {
    setAssigning(customer._id);

    try {
      const token = localStorage.getItem('adminToken');
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/shared-folders/remove`, {
        customerId: customer._id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(`Shared folder removed from ${customer.name} successfully!`);
      setTimeout(() => setSuccess(null), 5000);
      fetchCustomers();
    } catch (err: any) {
      console.error('Failed to remove shared folder', err);
      setError(err.response?.data?.error || 'Failed to remove shared folder');
    } finally {
      setAssigning(null);
    }
  };

  const openFolderLink = (link: string) => {
    window.open(link, '_blank');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FaFolder className="mr-3 text-blue-600" />
            Shared Folder Management
            {unreadNotesCount > 0 && (
              <span className="ml-3 bg-red-500 text-white text-sm font-bold px-2 py-1 rounded-full flex items-center">
                <FaBell className="mr-1" />
                {unreadNotesCount}
              </span>
            )}
          </h1>
          <p className="text-gray-600 mt-1">
            Assign Google Drive or Synology shared folder links to customers for media sharing
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setShowNotes(!showNotes);
              if (!showNotes) {
                fetchNotes();
              }
            }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FaStickyNote className="mr-2" />
            {showNotes ? 'Hide Notes' : 'View Notes'}
            {unreadNotesCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {unreadNotesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              fetchCustomers();
              fetchUnreadNotesCount();
            }}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            <FaSyncAlt className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg flex items-center">
          <FaCheckCircle className="mr-2" />
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg flex items-center">
          <FaTimesCircle className="mr-2" />
          {error}
        </div>
      )}

      {/* Client Notes Section */}
      {showNotes && (
        <div className="mb-6 bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FaStickyNote className="mr-2 text-blue-600" />
                Client Notes
              </h3>
              {unreadNotesCount > 0 && (
                <button
                  onClick={markAllNotesAsRead}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  Mark All as Read
                </button>
              )}
            </div>
            <p className="text-gray-600 mt-1">
              Notes from customers about their shared media uploads
            </p>
          </div>

          <div className="p-6">
            {notesLoading ? (
              <div className="flex items-center justify-center py-8">
                <FaSpinner className="animate-spin text-2xl text-blue-600 mr-2" />
                <span className="text-gray-600">Loading notes...</span>
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8">
                <FaStickyNote className="text-4xl text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No client notes yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div
                    key={note._id}
                    className={`border rounded-lg p-4 ${
                      note.isRead ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <h4 className="font-semibold text-gray-900">{note.customerName}</h4>
                          {!note.isRead && (
                            <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-gray-800 mb-3">{note.note}</p>
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <span>Submitted: {new Date(note.createdAt).toLocaleDateString()}</span>
                          <span>Expires: {new Date(note.expiresAt).toLocaleDateString()}</span>
                          {note.isRead && note.readAt && (
                            <span>Read: {new Date(note.readAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        {!note.isRead && (
                          <button
                            onClick={() => markNoteAsRead(note._id)}
                            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg"
                            title="Mark as read"
                          >
                            <FaEye />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Clinic Shared Folder Assignments</h2>
          <p className="text-sm text-gray-600">{customers.length} clinics found</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clinic
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Folder Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned Folder
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr key={customer._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-500">{customer.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {customer.location || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {customer.sharedFolderLink ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <FaCheckCircle className="mr-1" />
                        Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <FaTimesCircle className="mr-1" />
                        Not Connected
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {customer.sharedFolderLink ? (
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900 mr-2">{customer.sharedFolderName}</span>
                        <button
                          onClick={() => openFolderLink(customer.sharedFolderLink!)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Open folder"
                        >
                          <FaExternalLinkAlt className="text-xs" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">No folder assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {customer.sharedFolderLink ? (
                        <button
                          onClick={() => handleRemoveFolder(customer)}
                          disabled={assigning === customer._id}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          {assigning === customer._id ? (
                            <FaSpinner className="animate-spin" />
                          ) : (
                            'Remove'
                          )}
                        </button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            placeholder="https://drive.google.com/... or https://synology.com/..."
                            value={selectedFolders[customer._id] || ''}
                            onChange={(e) => setSelectedFolders(prev => ({ ...prev, [customer._id]: e.target.value }))}
                            className="px-3 py-1 border border-gray-300 rounded text-sm w-64 text-gray-900 bg-white"
                          />
                          <button
                            onClick={() => handleAssignFolder(customer, selectedFolders[customer._id] || '')}
                            disabled={assigning === customer._id || !selectedFolders[customer._id]}
                            className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          >
                            {assigning === customer._id ? (
                              <FaSpinner className="animate-spin" />
                            ) : (
                              'Assign'
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">How it works</h3>
        <div className="space-y-2 text-blue-800">
          <p>• <strong>Create Shared Folder:</strong> Create a Google Drive or Synology shared folder for each clinic</p>
          <p>• <strong>Assign Folder:</strong> Enter the folder link in the input field and click "Assign"</p>
          <p>• <strong>Customer Access:</strong> Customers can access their folder through the "Share Your Media" tab</p>
          <p>• <strong>Manage:</strong> You can remove or reassign folders at any time</p>
        </div>
      </div>
    </div>
  );
};

export default SharedFolderManagementPage;
