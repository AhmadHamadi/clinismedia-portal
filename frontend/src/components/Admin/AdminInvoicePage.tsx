import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaEnvelope } from 'react-icons/fa';

interface Clinic {
  _id: string;
  name: string;
  email: string;
}

interface Invoice {
  _id: string;
  name: string;
  url: string;
  date: string;
}

interface AssignedInvoice {
  _id: string;
  invoiceId: Invoice;
  isCurrent: boolean;
  assignedAt: string;
}

const AdminInvoicePage: React.FC = () => {
  // Master invoices
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [newInvoiceName, setNewInvoiceName] = useState('');
  const [newInvoiceFile, setNewInvoiceFile] = useState<File | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [clinicAssignments, setClinicAssignments] = useState<AssignedInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);

  // Filtering
  const [selectedClinic, setSelectedClinic] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);

  // Email notification state
  const [selectedEmailClinic, setSelectedEmailClinic] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('Invoice Update');
  const [emailBody, setEmailBody] = useState('Hi {clinicName},\n\nWe have uploaded your latest invoice.\n\nBest regards,\nCliniMedia Team');
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

  // Fetch invoices and clinics
  const fetchInvoices = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvoices(res.data);
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    }
  };

  const fetchClinicsAndAssignments = async () => {
    const token = localStorage.getItem('adminToken');
    try {
      const clinicsRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinics(clinicsRes.data);
      const assignmentsRes = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/invoices/assignments/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinicAssignments(assignmentsRes.data.assignments);
    } catch (error) {
      console.error('Error fetching clinics and assignments:', error);
    }
  };

  // Apply filters
  useEffect(() => {
    let filtered = invoices;

    // Filter by clinic
    if (selectedClinic) {
      const assignedInvoiceIds = clinicAssignments
        .filter(a => {
          if (typeof a.invoiceId === 'string') return a.invoiceId === selectedClinic;
          return a.invoiceId._id === selectedClinic;
        })
        .map(a => typeof a.invoiceId === 'string' ? a.invoiceId : a.invoiceId._id);
      
      filtered = filtered.filter(invoice => assignedInvoiceIds.includes(invoice._id));
    }

    // Filter by month
    if (selectedMonth) {
      const assignedInvoiceIds = clinicAssignments
        .filter(a => {
          const assignmentDate = new Date(a.assignedAt);
          const assignmentMonth = assignmentDate.toISOString().slice(0, 7);
          return assignmentMonth === selectedMonth;
        })
        .map(a => typeof a.invoiceId === 'string' ? a.invoiceId : a.invoiceId._id);
      
      filtered = filtered.filter(invoice => assignedInvoiceIds.includes(invoice._id));
    }

    setFilteredInvoices(filtered);
  }, [invoices, clinicAssignments, selectedClinic, selectedMonth]);

  useEffect(() => {
    fetchInvoices();
    fetchClinicsAndAssignments();
  }, []);

  // Upload and assign invoice
  const handleAddInvoice = async () => {
    if (!newInvoiceName.trim() || !newInvoiceFile || !selectedClinicId) return;
    setLoading(true);
    const token = localStorage.getItem('adminToken');
    // 1. Upload the PDF
    const formData = new FormData();
    formData.append('name', newInvoiceName);
    formData.append('pdf', newInvoiceFile);
    const uploadRes = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/invoices/upload`, formData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 2. Assign the new invoice to the selected clinic
    await axios.post(`${import.meta.env.VITE_API_BASE_URL}/invoices/assign`, {
      clinicId: selectedClinicId,
      invoiceIds: [uploadRes.data._id],
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setNewInvoiceName('');
    setNewInvoiceFile(null);
    setShowInvoiceModal(false);
    setSelectedClinicId('');
    setLoading(false);
    fetchInvoices();
    fetchClinicsAndAssignments();
  };

  // Delete invoice
  const handleDeleteInvoice = async (id: string) => {
    if (!window.confirm('Delete this invoice?')) return;
    const token = localStorage.getItem('adminToken');
    await axios.delete(`${import.meta.env.VITE_API_BASE_URL}/invoices/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchInvoices();
    fetchClinicsAndAssignments();
  };

  // Edit invoice
  const handleEditInvoice = async () => {
    if (!editInvoice) return;
    const token = localStorage.getItem('adminToken');
    await axios.put(`${import.meta.env.VITE_API_BASE_URL}/invoices/${editInvoice._id}`, editInvoice, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setShowEditModal(false);
    fetchInvoices();
  };

  // Get assignment info for an invoice
  const getInvoiceAssignments = (invoiceId: string) => {
    return clinicAssignments.filter(a => {
      const assignmentInvoiceId = typeof a.invoiceId === 'string' ? a.invoiceId : a.invoiceId._id;
      return assignmentInvoiceId === invoiceId;
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
    <div className="min-h-screen bg-gray-100 font-sans p-6">
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
              <h3 className="font-semibold text-black mb-2">Invoice Updates</h3>
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
          <h1 className="text-3xl font-bold text-[#303b45]">Invoice Management</h1>
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7]"
          >
            Add New Invoice
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

        {/* Combined Invoice Items and Assignments */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-[#303b45] mb-4">Invoice Items & Assignments</h2>
          
          {/* Results Summary */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Showing {filteredInvoices.length} item(s)
              {selectedClinic && ` for ${clinics.find(c => c._id === selectedClinic)?.name}`}
              {selectedMonth && ` in ${months.find(m => m.key === selectedMonth)?.label}`}
            </p>
          </div>

          {/* Invoice Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">PDF</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Assignment Status</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No invoice items found with the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(invoice => {
                    const assignments = getInvoiceAssignments(invoice._id);
                    
                    return (
                      <tr key={invoice._id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{invoice.name}</td>
                        <td className="py-3 px-4 text-blue-600">
                          <a
                            href={`${import.meta.env.VITE_BACKEND_BASE_URL}/api/invoices/view/${invoice.url.split('/').pop()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline mr-2"
                          >
                            View
                          </a>
                          <a
                            href={`${import.meta.env.VITE_BACKEND_BASE_URL}/api/invoices/file/${invoice.url.split('/').pop()}`}
                            download
                            className="text-green-600 hover:underline"
                          >
                            Download
                          </a>
                        </td>
                        <td className="py-3 px-4 text-gray-700">{new Date(invoice.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          {assignments.length === 0 ? (
                            <span className="text-gray-400 text-sm">Not assigned</span>
                          ) : (
                            <div className="space-y-2">
                              {assignments.map(assignment => {
                                const clinicId = typeof assignment.invoiceId === 'string' ? assignment.invoiceId : assignment.invoiceId._id;
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
                                      <select
                                        className="border p-1 rounded text-xs text-black"
                                        value={status.toLowerCase()}
                                        onChange={async e => {
                                          const isCurrent = e.target.value === 'current';
                                          // Note: You'll need to implement handleUpdateAssignment for invoices
                                          // await handleUpdateAssignment(clinicId, invoice._id, isCurrent);
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
                              setEditInvoice(invoice);
                              setShowEditModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice._id)}
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
        </div>
      </div>

      {/* Add Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Add New Invoice</h3>
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
              placeholder="Invoice Name"
              value={newInvoiceName}
              onChange={e => setNewInvoiceName(e.target.value)}
              className="w-full p-2 border rounded mb-2 text-black"
            />
            <input
              type="file"
              accept="application/pdf"
              onChange={e => setNewInvoiceFile(e.target.files?.[0] || null)}
              className="w-full p-2 border rounded mb-4 text-black"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddInvoice}
                className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7]"
                disabled={!newInvoiceName.trim() || !newInvoiceFile || !selectedClinicId || loading}
              >
                {loading ? 'Uploading...' : 'Add'}
              </button>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {showEditModal && editInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Edit Invoice</h3>
            <input
              type="text"
              placeholder="Invoice Name"
              value={editInvoice.name}
              onChange={e => setEditInvoice({ ...editInvoice, name: e.target.value })}
              className="w-full p-2 border rounded mb-2 text-black"
            />
            <input
              type="date"
              value={editInvoice.date ? editInvoice.date.slice(0, 10) : ''}
              onChange={e => setEditInvoice({ ...editInvoice, date: e.target.value })}
              className="w-full p-2 border rounded mb-4 text-black"
            />
            <div className="flex gap-2">
              <button
                onClick={handleEditInvoice}
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

export default AdminInvoicePage; 