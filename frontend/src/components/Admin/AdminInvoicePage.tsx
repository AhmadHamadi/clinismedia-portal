import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, BACKEND_BASE_URL } from '../../utils/api';

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
  clinicId: Clinic | string;
  invoiceId: Invoice | string;
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

  // Fetch invoices and clinics
  const fetchInvoices = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const res = await axios.get(`${API_BASE_URL}/invoices`, {
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
      const clinicsRes = await axios.get(`${API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinics(clinicsRes.data);
      const assignmentsRes = await axios.get(`${API_BASE_URL}/invoices/assignments/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setClinicAssignments(assignmentsRes.data.assignments);
    } catch (error) {
      console.error('Error fetching clinics and assignments:', error);
    }
  };

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
    const uploadRes = await axios.post(`${API_BASE_URL}/invoices/upload`, formData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 2. Assign the new invoice to the selected clinic
    await axios.post(`${API_BASE_URL}/invoices/assign`, {
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
    await axios.delete(`${API_BASE_URL}/invoices/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchInvoices();
    fetchClinicsAndAssignments();
  };

  // Edit invoice
  const handleEditInvoice = async () => {
    if (!editInvoice) return;
    const token = localStorage.getItem('adminToken');
    await axios.put(`${API_BASE_URL}/invoices/${editInvoice._id}`, editInvoice, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setShowEditModal(false);
    fetchInvoices();
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100 font-sans gap-6 p-6">
      {/* Left: Master Invoice List */}
      <div className="w-full md:w-2/3 bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-[#303b45]">Invoices</h1>
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="px-4 py-2 bg-[#98c6d5] text-white rounded hover:bg-[#7bb3c7]"
          >
            Add New Invoice
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-600 border-b">
                <th className="py-2">Name</th>
                <th className="py-2">PDF</th>
                <th className="py-2">Date</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(invoice => (
                <tr key={invoice._id} className="border-b hover:bg-gray-50">
                  <td className="py-2 font-medium text-gray-900">{invoice.name}</td>
                  <td className="py-2 text-blue-600">
                    <a
                      href={BACKEND_BASE_URL + '/api/invoices/view/' + invoice.url.split('/').pop()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      View
                    </a>
                    <a
                      href={BACKEND_BASE_URL + '/api/invoices/file/' + invoice.url.split('/').pop()}
                      download
                      className="ml-2 text-green-600 hover:underline"
                    >
                      Download
                    </a>
                  </td>
                  <td className="py-2 text-gray-700">{new Date(invoice.date).toLocaleDateString()}</td>
                  <td className="py-2">
                    <button
                      onClick={() => {
                        setEditInvoice(invoice);
                        setShowEditModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 mr-2"
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Right: Clinic Assignments */}
      <div className="w-full md:w-1/3 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-[#303b45] mb-4">Clinic Assignments</h2>
        <div className="mb-4">
          <select
            value={selectedClinicId}
            onChange={e => setSelectedClinicId(e.target.value)}
            className="w-full p-2 border rounded text-black"
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
        </div>
        {/* Selected Clinic Assignments */}
        {selectedClinicId && (
          <div>
            <h3 className="font-semibold mb-2">
              {clinics.find(c => c._id === selectedClinicId)?.name}
            </h3>
            <ul className="space-y-2">
              {clinicAssignments
                .filter(a => {
                  if (typeof a.clinicId === 'string') return a.clinicId === selectedClinicId;
                  return a.clinicId._id === selectedClinicId;
                })
                .map(a => {
                  const invoice = typeof a.invoiceId === 'string' ? null : a.invoiceId;
                  if (!invoice) return null;
                  const status = a.isCurrent ? 'current' : 'history';
                  let statusColor = 'text-gray-500';
                  if (status === 'current') statusColor = 'text-green-600';
                  return (
                    <li key={a._id} className="flex flex-col md:flex-row md:items-center gap-2 border-b pb-2">
                      <div className="flex-1">
                        <div className="font-medium text-black">{invoice.name}</div>
                        <div className="text-xs text-[#98c6d5]">{new Date(a.assignedAt).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={BACKEND_BASE_URL + '/api/invoices/view/' + invoice.url.split('/').pop()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs"
                        >
                          View
                        </a>
                        <a
                          href={BACKEND_BASE_URL + '/api/invoices/file/' + invoice.url.split('/').pop()}
                          download
                          className="text-green-600 hover:underline text-xs"
                        >
                          Download
                        </a>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
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
    </div>
  );
};

export default AdminInvoicePage; 