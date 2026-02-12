import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaFacebook, FaPlus, FaEdit, FaTrash, FaSyncAlt, FaSpinner } from 'react-icons/fa';

interface SubjectMapping {
  _id: string;
  customerId: {
    _id: string;
    name: string;
    email: string;
    location?: string;
  };
  emailSubject: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FolderMapping {
  _id: string;
  customerId: {
    _id: string;
    name: string;
    email: string;
    location?: string;
  };
  folderName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Customer {
  _id: string;
  name: string;
  email: string;
  location?: string;
}

const MetaLeadsManagementPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mappings, setMappings] = useState<SubjectMapping[]>([]);
  const [folderMappings, setFolderMappings] = useState<FolderMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<SubjectMapping | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    emailSubject: '',
    isActive: true
  });
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolderMapping, setEditingFolderMapping] = useState<FolderMapping | null>(null);
  const [folderFormData, setFolderFormData] = useState({
    customerId: '',
    folderName: '',
    isActive: true
  });
  const [checkingEmails, setCheckingEmails] = useState(false);
  const [testSubjectInput, setTestSubjectInput] = useState('');
  const [testSubjectResult, setTestSubjectResult] = useState<{ match: boolean; normalizedSubject?: string; customerName?: string; customerEmail?: string } | null>(null);
  const [testingSubject, setTestingSubject] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      // Fetch customers, subject mappings, and folder mappings in parallel
      const [customersRes, mappingsRes, folderMappingsRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/meta-leads/admin/subject-mappings`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${import.meta.env.VITE_API_BASE_URL}/meta-leads/admin/folder-mappings`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setCustomers(customersRes.data || []);
      setMappings(mappingsRes.data.mappings || []);
      setFolderMappings(folderMappingsRes.data.folderMappings || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMappingsForCustomer = (customerId: string): SubjectMapping[] => {
    return mappings.filter(m => m.customerId._id === customerId && m.isActive);
  };

  const getFolderMappingsForCustomer = (customerId: string): FolderMapping[] => {
    return folderMappings.filter(m => m.customerId._id === customerId && m.isActive);
  };

  const handleCreateFolder = () => {
    setEditingFolderMapping(null);
    setFolderFormData({ customerId: '', folderName: '', isActive: true });
    setShowFolderModal(true);
  };

  const handleEditFolder = (mapping: FolderMapping) => {
    setEditingFolderMapping(mapping);
    setFolderFormData({
      customerId: mapping.customerId._id,
      folderName: mapping.folderName,
      isActive: mapping.isActive
    });
    setShowFolderModal(true);
  };

  const handleSubmitFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      if (editingFolderMapping) {
        await axios.patch(
          `${import.meta.env.VITE_API_BASE_URL}/meta-leads/admin/folder-mappings/${editingFolderMapping._id}`,
          folderFormData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/meta-leads/admin/folder-mappings`,
          folderFormData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setShowFolderModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Failed to save folder mapping:', error);
      alert(error.response?.data?.message || 'Failed to save folder mapping');
    }
  };

  const handleDeleteFolder = async (mappingId: string) => {
    if (!window.confirm('Delete this folder mapping? Leads in this folder will no longer be auto-assigned.')) return;
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;
      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/meta-leads/admin/folder-mappings/${mappingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to delete folder mapping');
    }
  };

  const handleCreate = () => {
    setEditingMapping(null);
    setFormData({
      customerId: '',
      emailSubject: '',
      isActive: true
    });
    setShowModal(true);
  };

  const handleEdit = (mapping: SubjectMapping) => {
    setEditingMapping(mapping);
    setFormData({
      customerId: mapping.customerId._id,
      emailSubject: mapping.emailSubject,
      isActive: mapping.isActive
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      if (editingMapping) {
        await axios.patch(
          `${import.meta.env.VITE_API_BASE_URL}/meta-leads/admin/subject-mappings/${editingMapping._id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/meta-leads/admin/subject-mappings`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setShowModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Failed to save mapping:', error);
      alert(error.response?.data?.message || 'Failed to save mapping');
    }
  };

  const handleDelete = async (mappingId: string) => {
    if (!window.confirm('Are you sure you want to delete this subject mapping?')) {
      return;
    }

    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/meta-leads/admin/subject-mappings/${mappingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      fetchData();
    } catch (error: any) {
      console.error('Failed to delete mapping:', error);
      alert(error.response?.data?.message || 'Failed to delete mapping');
    }
  };

  const handleTriggerEmailCheck = async () => {
    setCheckingEmails(true);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;

      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/meta-leads/admin/check-emails`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const result = res.data?.result || {};
      const msg = result.errors?.length
        ? `Check finished with errors: ${result.errors.join('; ')}. Emails found: ${result.emailsFound}, leads created: ${result.leadsCreated}.`
        : `Check done: ${result.emailsFound} email(s) found, ${result.leadsCreated} lead(s) created.`;
      alert(msg);
    } catch (error: any) {
      console.error('Failed to trigger email check:', error);
      alert(error.response?.data?.message || 'Failed to trigger email check');
    } finally {
      setCheckingEmails(false);
    }
  };

  const handleTestSubject = async () => {
    const subject = testSubjectInput.trim();
    if (!subject) {
      alert('Enter a subject line to test');
      return;
    }
    setTestingSubject(true);
    setTestSubjectResult(null);
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) return;
      const res = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/meta-leads/admin/test-subject`,
        { params: { subject }, headers: { Authorization: `Bearer ${token}` } }
      );
      setTestSubjectResult(res.data);
    } catch (error: any) {
      setTestSubjectResult({ match: false, normalizedSubject: subject });
      alert(error.response?.data?.message || 'Failed to test subject');
    } finally {
      setTestingSubject(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-[#98c6d5] mx-auto mb-4" />
          <p className="text-gray-600">Loading Meta Leads management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center">
            <FaFacebook className="text-4xl text-[#1877f3] mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meta Leads Management</h1>
              <p className="text-gray-600">Assign email subject mappings to clinics for Facebook lead tracking</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Test subject line (paste from a real lead email)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testSubjectInput}
                  onChange={(e) => setTestSubjectInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTestSubject()}
                  placeholder="e.g. CliniMedia - Burlington Dental Leads"
                  className="px-3 py-2 border border-gray-300 rounded-lg min-w-[280px] text-gray-900"
                />
                <button
                  type="button"
                  onClick={handleTestSubject}
                  disabled={testingSubject || !testSubjectInput.trim()}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 disabled:opacity-50"
                >
                  {testingSubject ? <FaSpinner className="animate-spin" /> : 'Test'}
                </button>
              </div>
              {testSubjectResult && (
                <div className={`text-sm mt-1 px-2 py-1 rounded ${testSubjectResult.match ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                  {testSubjectResult.match ? (
                    <>→ Matches clinic: <strong>{testSubjectResult.customerName}</strong> ({testSubjectResult.customerEmail})</>
                  ) : (
                    <>→ No mapping for this subject. Add a subject mapping that matches: &quot;{testSubjectResult.normalizedSubject || testSubjectInput}&quot;</>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleTriggerEmailCheck}
              disabled={checkingEmails}
              className="flex items-center px-4 py-2 bg-[#1877f3] text-white rounded-lg font-semibold hover:bg-[#145db2] disabled:opacity-50"
            >
              {checkingEmails ? (
                <>
                  <FaSpinner className="mr-2 animate-spin" /> Checking...
                </>
              ) : (
                <>
                  <FaSyncAlt className="mr-2" /> Check Emails Now
                </>
              )}
            </button>
            <button
              onClick={handleCreate}
              className="flex items-center px-4 py-2 bg-[#98c6d5] text-white rounded-lg font-semibold hover:bg-[#7db3c4]"
            >
              <FaPlus className="mr-2" /> Add Subject Mapping
            </button>
            <button
              onClick={fetchData}
              className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              title="Refresh data"
            >
              <FaSyncAlt className="mr-2" /> Refresh
            </button>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Clinic Subject Mappings</h2>
            <p className="text-sm text-gray-600 mt-1">
              {customers.length} clinic{customers.length !== 1 ? 's' : ''} found
            </p>
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
                    Assigned Email Subjects
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => {
                  const customerMappings = getMappingsForCustomer(customer._id);
                  return (
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
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {customerMappings.length > 0 ? (
                          <div className="space-y-1">
                            {customerMappings.map((mapping) => (
                              <div
                                key={mapping._id}
                                className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs mr-2 mb-1"
                              >
                                {mapping.emailSubject}
                                {!mapping.isActive && (
                                  <span className="ml-1 text-red-600">(Inactive)</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No subjects assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => {
                            setFormData({
                              customerId: customer._id,
                              emailSubject: '',
                              isActive: true
                            });
                            setEditingMapping(null);
                            setShowModal(true);
                          }}
                          className="text-[#98c6d5] hover:text-[#7db3c4] font-medium mr-3"
                        >
                          Add Subject
                        </button>
                        {customerMappings.length > 0 && (
                          <div className="inline-flex gap-2">
                            {customerMappings.map((mapping) => (
                              <div key={mapping._id} className="inline-flex gap-1">
                                <button
                                  onClick={() => handleEdit(mapping)}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Edit"
                                >
                                  <FaEdit />
                                </button>
                                <button
                                  onClick={() => handleDelete(mapping._id)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete"
                                >
                                  <FaTrash />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {customers.length === 0 && (
            <div className="text-center py-12">
              <FaFacebook className="text-4xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No clinics found</h3>
              <p className="text-gray-500">Add some clinics first to manage their subject mappings.</p>
            </div>
          )}
        </div>

        {/* Folder Mappings (cPanel) */}
        <div className="mt-8 bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Folder Mappings (cPanel)</h2>
              <p className="text-sm text-gray-600 mt-1">
                Map IMAP folder names to clinics. When leads land in a folder (e.g. &quot;Burlington Dental Centre&quot;), they are assigned to that clinic. Use this if your leads go into per-clinic folders.
              </p>
            </div>
            <button
              onClick={handleCreateFolder}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
            >
              <FaPlus className="mr-2" /> Add Folder Mapping
            </button>
          </div>

          <div className="overflow-x-auto">
            {folderMappings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No folder mappings. Add one to assign leads by folder name (e.g. &quot;Burlington Dental Centre&quot;).
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folder name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clinic</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {folderMappings.map((fm) => (
                    <tr key={fm._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-mono text-sm text-gray-900">{fm.folderName}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {fm.customerId?.name} <span className="text-gray-500">({fm.customerId?.email})</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {fm.isActive ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">Active</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button onClick={() => handleEditFolder(fm)} className="text-blue-600 hover:text-blue-800 mr-3" title="Edit"><FaEdit /></button>
                        <button onClick={() => handleDeleteFolder(fm._id)} className="text-red-600 hover:text-red-800" title="Delete"><FaTrash /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How it works</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Add Subject Mapping:</strong> Click "Add Subject Mapping" or "Add Subject" next to a clinic to create a new mapping.</p>
            <p>• <strong>Email Subjects:</strong> When Facebook sends lead emails to leads@clinimedia.ca, the system matches the email subject to assign leads to the correct clinic.</p>
            <p>• <strong>Example:</strong> If subject is "CliniMedia-moonstone dental leads", create a mapping with that exact subject for Moonstone Dental.</p>
            <p>• <strong>Folder Mappings:</strong> If leads go into cPanel folders per clinic (e.g. &quot;Burlington Dental Centre&quot;), add a folder mapping so all emails in that folder are assigned to that clinic. Folder is checked first, then subject.</p>
            <p>• <strong>Check Emails:</strong> Use &quot;Check Emails Now&quot; to manually trigger email processing, or wait for automatic checks every 3 minutes.</p>
            <p>• <strong>Edit/Delete:</strong> Use the edit/delete icons next to each mapping to manage them.</p>
          </div>
        </div>
      </div>

      {/* Subject Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingMapping ? 'Edit Subject Mapping' : 'Create Subject Mapping'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clinic *
                </label>
                <select
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
                  style={{ 
                    color: '#111827',
                    backgroundColor: editingMapping ? '#f9fafb' : '#ffffff'
                  }}
                  required
                  disabled={!!editingMapping}
                >
                  <option value="" style={{ color: '#111827', backgroundColor: '#ffffff' }}>Select a clinic</option>
                  {customers.map((customer) => (
                    <option 
                      key={customer._id} 
                      value={customer._id} 
                      style={{ color: '#111827', backgroundColor: '#ffffff' }}
                    >
                      {customer.name} ({customer.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Subject *
                </label>
                      <input
                        type="text"
                        value={formData.emailSubject}
                        onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        style={{ color: '#111827' }}
                        placeholder="e.g., CliniMedia - Dentistry On 66 Leads"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the exact subject line from Facebook Lead emails (format: "CliniMedia - [Clinic Name] Leads")
                      </p>
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7db3c4]"
                >
                  {editingMapping ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Folder Mapping Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingFolderMapping ? 'Edit Folder Mapping' : 'Add Folder Mapping'}
            </h2>
            <form onSubmit={handleSubmitFolder}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Clinic *</label>
                <select
                  value={folderFormData.customerId}
                  onChange={(e) => setFolderFormData({ ...folderFormData, customerId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                  required
                  disabled={!!editingFolderMapping}
                >
                  <option value="">Select a clinic</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Folder name *</label>
                <input
                  type="text"
                  value={folderFormData.folderName}
                  onChange={(e) => setFolderFormData({ ...folderFormData, folderName: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Burlington Dental Centre"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Exact folder name as in cPanel (e.g. Burlington Dental Centre, Hamilton Care Dental)</p>
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={folderFormData.isActive}
                    onChange={(e) => setFolderFormData({ ...folderFormData, isActive: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  {editingFolderMapping ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowFolderModal(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetaLeadsManagementPage;
