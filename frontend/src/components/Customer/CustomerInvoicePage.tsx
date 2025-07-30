import React, { useEffect, useState } from 'react';
import axios from 'axios';

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

const DecorativeSparkle = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2 animate-pulse">
    <path d="M16 2L18.09 10.26L26 12L18.09 13.74L16 22L13.91 13.74L6 12L13.91 10.26L16 2Z" fill="#98c6d5"/>
  </svg>
);

const CustomerInvoicePage: React.FC = () => {
  const [assignedInvoices, setAssignedInvoices] = useState<AssignedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentInvoice, setCurrentInvoice] = useState<AssignedInvoice | null>(null);
  const [historyInvoices, setHistoryInvoices] = useState<AssignedInvoice[]>([]);

  useEffect(() => {
    const fetchAssignedInvoices = async () => {
      setLoading(true);
      const token = localStorage.getItem('customerToken');
      const userStr = localStorage.getItem('customerData');
      if (!userStr) {
        setLoading(false);
        return;
      }
      const user = JSON.parse(userStr);
      const clinicId = user.id || user._id;
      try {
        const res = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/invoices/assigned/${clinicId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAssignedInvoices(res.data);
        const current = res.data.find((item: AssignedInvoice) => item.isCurrent);
        const history = res.data.filter((item: AssignedInvoice) => !item.isCurrent);
        setCurrentInvoice(current || null);
        setHistoryInvoices(history);
      } catch (err) {
        setAssignedInvoices([]);
        setCurrentInvoice(null);
        setHistoryInvoices([]);
      }
      setLoading(false);
    };
    fetchAssignedInvoices();
  }, []);

  if (loading) return <div className="p-6 text-gray-600">Loading invoices...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6">
      {/* Left: Current Invoice */}
      <div className="w-full lg:w-2/3">
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-2 py-8 bg-gradient-to-br from-[#f8fafc] to-[#e0f2fe]">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-10 flex flex-col items-center border border-[#e0e7ef] relative">
            {currentInvoice ? (
              <>
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    Latest Invoice
                  </span>
                </div>
                <h1 className="text-3xl font-extrabold text-[#60a5fa] mb-2 tracking-tight text-center font-sans">
                  {currentInvoice.invoiceId.name}
                </h1>
                <p className="text-gray-600 text-center mb-6 max-w-md font-medium">
                  Access your latest invoice securely. Assigned on {new Date(currentInvoice.assignedAt).toLocaleDateString()}.
                </p>
                <div className="flex gap-4">
                  <a
                    href={`${import.meta.env.VITE_API_BASE_URL}/invoices/view/${currentInvoice.invoiceId.url.split('/').pop()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 hover:scale-105 transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-blue-600/40"
                  >
                    View Invoice
                  </a>
                  <a
                    href={`${import.meta.env.VITE_API_BASE_URL}/invoices/file/${currentInvoice.invoiceId.url.split('/').pop()}`}
                    download
                    className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-green-700 hover:scale-105 transition-all duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-green-600/40"
                  >
                    Download Invoice
                  </a>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-3xl font-extrabold text-[#60a5fa] mb-2 tracking-tight text-center font-sans">
                  No Current Invoice
                </h1>
                <p className="text-gray-600 text-center mb-6 max-w-md font-medium">
                  No invoice has been assigned to you yet. Check back later or contact your administrator.
                </p>
                <div className="mt-2 px-8 py-3 bg-gray-300 text-gray-600 rounded-xl font-bold text-lg">
                  <span className="inline-block align-middle mr-2">⏳</span> Awaiting Assignment
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Right: Invoice History */}
      <div className="w-full lg:w-1/3">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-[#303b45] mb-4">Invoice History</h2>
          {historyInvoices.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No previous invoices found.</p>
          ) : (
            <div className="space-y-3">
              {historyInvoices.map((item) => (
                <div key={item._id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-1">{item.invoiceId.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Assigned: {new Date(item.assignedAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL}/invoices/view/${item.invoiceId.url.split('/').pop()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm font-medium"
                    >
                      View
                    </a>
                    <a
                      href={`${import.meta.env.VITE_API_BASE_URL}/invoices/file/${item.invoiceId.url.split('/').pop()}`}
                      download
                      className="text-green-600 hover:underline text-sm font-medium"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerInvoicePage; 