import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  FaFacebook,
  FaFolderOpen,
  FaCheckCircle,
  FaTimesCircle,
  FaSpinner,
  FaSyncAlt,
  FaPlus,
  FaEdit,
  FaTrash,
  FaInbox,
} from 'react-icons/fa';

interface Customer {
  _id: string;
  name: string;
  email: string;
  location?: string;
}

interface FolderMapping {
  _id: string;
  customerId: {
    _id: string;
    name: string;
    email: string;
  };
  folderName: string;
  isActive: boolean;
  notes?: string | null;
}

interface MonitoringStatus {
  monitoringEnabled: boolean;
  intervalMinutes: number | null;
  hasCredentials: boolean;
  isChecking: boolean;
  mailboxUser: string;
  mailboxHost: string;
  mailboxPort: number;
  lastMonitoringStartedAt: string | null;
  lastCheckCompletedAt: string | null;
  lastSuccessfulCheckAt: string | null;
  lastError: string | null;
}

interface AuditResponse {
  totalMappedClinics: number;
  staleClinics: number;
}

const apiBase = import.meta.env.VITE_API_BASE_URL;
const CORE_REQUEST_TIMEOUT_MS = 8000;

const normalizeFolderName = (folderName: string) =>
  folderName
    .split('.')
    .pop()
    ?.trim()
    .replace(/\s+/g, ' ')
    .toLowerCase() || '';

const MetaLeadsManagementPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [folderMappings, setFolderMappings] = useState<FolderMapping[]>([]);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingEmails, setCheckingEmails] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [availableFoldersError, setAvailableFoldersError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [imapTestLoading, setImapTestLoading] = useState(false);
  const [importingMappingId, setImportingMappingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [imapTestMessage, setImapTestMessage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<FolderMapping | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    folderName: '',
    isActive: true,
    notes: '',
  });

  const getHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  };

  const fetchCoreData = async () => {
    const headers = getHeaders();
    if (!headers) return;

    const requestConfig = {
      headers,
      timeout: CORE_REQUEST_TIMEOUT_MS,
    };

    const [customersRes, folderMappingsRes, monitoringRes, auditRes] = await Promise.allSettled([
      axios.get(`${apiBase}/customers`, requestConfig),
      axios.get(`${apiBase}/meta-leads/admin/folder-mappings`, requestConfig),
      axios.get(`${apiBase}/meta-leads/admin/monitoring-status`, requestConfig),
      axios.get(`${apiBase}/meta-leads/admin/ingestion-audit`, requestConfig),
    ]);

    if (customersRes.status === 'fulfilled') {
      setCustomers(customersRes.value.data || []);
    }

    if (folderMappingsRes.status === 'fulfilled') {
      setFolderMappings(folderMappingsRes.value.data.mappings || []);
    }

    if (monitoringRes.status === 'fulfilled') {
      setMonitoringStatus(monitoringRes.value.data.status || null);
    }

    if (auditRes.status === 'fulfilled') {
      setAudit(auditRes.value.data || null);
    }

    const failures = [
      customersRes.status === 'rejected' ? 'customers' : null,
      folderMappingsRes.status === 'rejected' ? 'folder mappings' : null,
      monitoringRes.status === 'rejected' ? 'monitoring status' : null,
      auditRes.status === 'rejected' ? 'ingestion audit' : null,
    ].filter(Boolean);

    if (failures.length === 4) {
      throw new Error('Failed to load Meta Leads data');
    }

    if (failures.length > 0) {
      setError(`Some Meta Leads data could not be loaded yet: ${failures.join(', ')}.`);
    }
  };

  const fetchAvailableFolders = async (silent = false) => {
    const headers = getHeaders();
    if (!headers) return;

    if (!silent) {
      clearMessages();
      setFoldersLoading(true);
    }

    try {
      const res = await axios.get(`${apiBase}/meta-leads/admin/available-folders`, {
        headers,
        timeout: 8000,
      });
      setAvailableFolders(res.data.folders || []);
      setAvailableFoldersError(null);
      if (!silent) {
        setSuccess('Mailbox folders refreshed successfully.');
      }
    } catch (err: any) {
      setAvailableFoldersError(err.response?.data?.error || err.response?.data?.message || 'Failed to refresh mailbox folders');
      if (!silent) {
        setError(err.response?.data?.message || 'Failed to refresh mailbox folders');
      }
    } finally {
      if (!silent) {
        setFoldersLoading(false);
      }
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchCoreData();
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load Meta Leads data');
      } finally {
        setLoading(false);
      }

      fetchAvailableFolders(true);
    })();
  }, []);

  useEffect(() => {
    const refreshSilently = async () => {
      try {
        await Promise.allSettled([
          fetchCoreData(),
          fetchAvailableFolders(true),
        ]);
      } catch (err) {
        // Keep the last known UI visible if a background refresh fails.
      }
    };

    const interval = window.setInterval(refreshSilently, 60 * 1000);
    const handleFocus = () => refreshSilently();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshSilently();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const folderMappingsByCustomer = useMemo(() => {
    const grouped: Record<string, FolderMapping[]> = {};
    for (const mapping of folderMappings) {
      const key = mapping.customerId._id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(mapping);
    }
    return grouped;
  }, [folderMappings]);

  const folderAssignments = useMemo(() => {
    const assignments = new Map<string, FolderMapping>();
    for (const mapping of folderMappings) {
      assignments.set(normalizeFolderName(mapping.folderName), mapping);
    }
    return assignments;
  }, [folderMappings]);

  const modalFolderOptions = useMemo(() => {
    const options = [...availableFolders];
    if (formData.folderName && !options.includes(formData.folderName)) {
      options.unshift(formData.folderName);
    }
    return options;
  }, [availableFolders, formData.folderName]);

  const selectedFolderMapping = useMemo(() => {
    if (!formData.folderName) return null;
    return folderAssignments.get(normalizeFolderName(formData.folderName)) || null;
  }, [folderAssignments, formData.folderName]);

  const fmtDateTime = (value?: string | null) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleRefreshAll = async () => {
    clearMessages();
    setRefreshing(true);
    try {
      await fetchCoreData();
      setSuccess('Meta Leads data refreshed successfully.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to refresh Meta Leads data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshFolders = async () => {
    await fetchAvailableFolders(false);
  };

  const handleRefreshHealth = async () => {
    const headers = getHeaders();
    if (!headers) return;

    clearMessages();
    setHealthLoading(true);
    try {
      const [monitoringRes, auditRes] = await Promise.all([
        axios.get(`${apiBase}/meta-leads/admin/monitoring-status`, { headers }),
        axios.get(`${apiBase}/meta-leads/admin/ingestion-audit`, { headers }),
      ]);
      setMonitoringStatus(monitoringRes.data.status || null);
      setAudit(auditRes.data || null);
      setSuccess('Meta Leads health refreshed successfully.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to refresh Meta Leads health');
    } finally {
      setHealthLoading(false);
    }
  };

  const handleTestImap = async () => {
    const headers = getHeaders();
    if (!headers) return;

    clearMessages();
    setImapTestLoading(true);
    setImapTestMessage(null);
    try {
      const res = await axios.get(`${apiBase}/meta-leads/admin/test-imap-connection`, { headers });
      const result = res.data?.result;
      setImapTestMessage(
        result?.ok
          ? `IMAP OK. INBOX total: ${result?.inbox?.total ?? 'N/A'}, unread: ${result?.inbox?.unread ?? 'N/A'}`
          : 'IMAP connection test failed'
      );
      if (result?.ok) {
        setSuccess('IMAP connection is working.');
      }
    } catch (err: any) {
      const message = err.response?.data?.result?.error || err.response?.data?.message || 'Failed to test IMAP connection';
      setImapTestMessage(message);
      setError(message);
    } finally {
      setImapTestLoading(false);
    }
  };

  const handleCheckEmails = async () => {
    const headers = getHeaders();
    if (!headers) return;

    clearMessages();
    setCheckingEmails(true);
    try {
      const res = await axios.post(`${apiBase}/meta-leads/admin/check-emails`, {}, { headers });
      const result = res.data?.result || {};
      setSuccess(
        result.errors?.length
          ? `Check finished with warnings. Emails found: ${result.emailsFound ?? 0}, leads created: ${result.leadsCreated ?? 0}.`
          : `Check completed. Emails found: ${result.emailsFound ?? 0}, leads created: ${result.leadsCreated ?? 0}.`
      );
      await handleRefreshHealth();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to check emails');
    } finally {
      setCheckingEmails(false);
    }
  };

  const openCreateModal = () => {
    clearMessages();
    setEditingMapping(null);
    setFormData({ customerId: '', folderName: '', isActive: true, notes: '' });
    setShowModal(true);
  };

  const openEditModal = (mapping: FolderMapping) => {
    clearMessages();
    setEditingMapping(mapping);
    setFormData({
      customerId: mapping.customerId._id,
      folderName: mapping.folderName,
      isActive: mapping.isActive,
      notes: mapping.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const headers = getHeaders();
    if (!headers) return;

    clearMessages();
    try {
      if (editingMapping) {
        await axios.patch(`${apiBase}/meta-leads/admin/folder-mappings/${editingMapping._id}`, formData, { headers });
        setSuccess('Folder mapping updated successfully.');
      } else {
        await axios.post(`${apiBase}/meta-leads/admin/folder-mappings`, formData, { headers });
        setSuccess('Folder mapping created successfully.');
      }
      setShowModal(false);
      await fetchCoreData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save folder mapping');
    }
  };

  const handleDelete = async (mapping: FolderMapping) => {
    const headers = getHeaders();
    if (!headers) return;
    if (!window.confirm(`Remove folder mapping "${mapping.folderName}" from ${mapping.customerId.name}?`)) return;

    clearMessages();
    try {
      await axios.delete(`${apiBase}/meta-leads/admin/folder-mappings/${mapping._id}`, { headers });
      setSuccess('Folder mapping removed successfully.');
      await fetchCoreData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete folder mapping');
    }
  };

  const handleImportFolder = async (mapping: FolderMapping) => {
    const headers = getHeaders();
    if (!headers) return;

    clearMessages();
    setImportingMappingId(mapping._id);
    try {
      const res = await axios.post(`${apiBase}/meta-leads/admin/folder-mappings/${mapping._id}/import`, {}, { headers });
      const result = res.data?.result || {};
      setSuccess(
        `Imported folder "${mapping.folderName}" for ${mapping.customerId.name}. ` +
        `Emails found: ${result.emailsFound ?? 0}, leads created for this clinic: ${result.leadsCreatedForCustomer ?? result.leadsCreated ?? 0}.`
      );
      await fetchCoreData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to import leads from folder');
    } finally {
      setImportingMappingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <FaSpinner className="animate-spin text-4xl text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FaFacebook className="mr-3 text-blue-600" />
            Meta Leads Folder Mapping
          </h1>
          <p className="text-gray-600 mt-1">
            Connect mailbox folders to clinics so incoming lead emails automatically route to the right customer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCheckEmails}
            disabled={checkingEmails}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {checkingEmails ? <FaSpinner className="mr-2 animate-spin" /> : <FaSyncAlt className="mr-2" />}
            {checkingEmails ? 'Checking...' : 'Check Emails Now'}
          </button>
          <button
            onClick={handleRefreshFolders}
            disabled={foldersLoading}
            className="flex items-center px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {foldersLoading ? <FaSpinner className="mr-2 animate-spin" /> : <FaFolderOpen className="mr-2" />}
            {foldersLoading ? 'Loading Folders...' : 'Refresh Folders'}
          </button>
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            <FaSyncAlt className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

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

      <div className="mb-6 bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Mailbox Health</h2>
              <p className="text-sm text-gray-500 mt-1">Verify mailbox access before mapping folders.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRefreshHealth}
                disabled={healthLoading}
                className="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                {healthLoading ? 'Refreshing...' : 'Refresh Health'}
              </button>
              <button
                onClick={handleTestImap}
                disabled={imapTestLoading}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {imapTestLoading ? 'Testing IMAP...' : 'Test IMAP Connection'}
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          {imapTestMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${imapTestMessage.startsWith('IMAP OK') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {imapTestMessage}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Poller</p>
              <p className="text-lg font-semibold text-gray-900">{monitoringStatus?.monitoringEnabled ? 'Running' : 'Not Running'}</p>
              <p className="text-sm text-gray-500">Every {monitoringStatus?.intervalMinutes ?? 'N/A'} min</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Mailbox</p>
              <p className="text-lg font-semibold text-gray-900 break-all">{monitoringStatus?.mailboxUser || 'N/A'}</p>
              <p className="text-sm text-gray-500">{monitoringStatus?.mailboxHost || 'N/A'}:{monitoringStatus?.mailboxPort ?? 'N/A'}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Mapped Clinics</p>
              <p className="text-lg font-semibold text-gray-900">{audit?.totalMappedClinics ?? 0}</p>
              <p className="text-sm text-gray-500">Stale clinics: {audit?.staleClinics ?? 0}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-500 mb-1">Last Activity</p>
              <p className="text-sm text-gray-700">Success: {fmtDateTime(monitoringStatus?.lastSuccessfulCheckAt)}</p>
              <p className="text-sm text-gray-700">Completed: {fmtDateTime(monitoringStatus?.lastCheckCompletedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Clinic Folder Mappings</h2>
            <p className="text-sm text-gray-500 mt-1">
              Choose one of the folders from the mailbox and assign it to the correct clinic.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FaPlus className="mr-2" />
            Add Folder Mapping
          </button>
        </div>

        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <div className="flex items-center gap-3">
              <FaInbox className="text-blue-600" />
              <span>{availableFolders.length} folder{availableFolders.length === 1 ? '' : 's'} currently available from the mailbox</span>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              Auto-refreshes every minute
            </span>
          </div>
          {availableFoldersError && (
            <p className="mt-3 text-sm text-red-600">
              Mailbox folder discovery is failing: {availableFoldersError}
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clinic</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mapped Folders</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {customers.map((customer) => {
                const mappings = folderMappingsByCustomer[customer._id] || [];
                return (
                  <tr key={customer._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-500">{customer.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{customer.location || 'N/A'}</td>
                    <td className="px-6 py-4">
                      {mappings.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {mappings.map((mapping) => (
                            <span
                              key={mapping._id}
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                mapping.isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {mapping.folderName}
                              {!mapping.isActive && <span className="ml-1">(Inactive)</span>}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">No folder mapped yet</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setEditingMapping(null);
                            setFormData({ customerId: customer._id, folderName: '', isActive: true, notes: '' });
                            setShowModal(true);
                          }}
                          className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Add
                        </button>
                        {mappings.map((mapping) => (
                          <div key={mapping._id} className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleImportFolder(mapping)}
                              className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-800 hover:bg-green-200 disabled:opacity-50"
                              disabled={importingMappingId === mapping._id}
                              title="Import leads from this folder"
                            >
                              {importingMappingId === mapping._id ? 'Importing...' : 'Import Leads'}
                            </button>
                            <button
                              onClick={() => openEditModal(mapping)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
                              title="Edit"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDelete(mapping)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100"
                              title="Delete"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingMapping ? 'Edit Folder Mapping' : 'Create Folder Mapping'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Clinic *</label>
                <select
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900"
                  required
                  disabled={!!editingMapping}
                >
                  <option value="">Select a clinic</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name} ({customer.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mailbox Folder *</label>
                {modalFolderOptions.length > 0 ? (
                  <select
                    value={formData.folderName}
                    onChange={(e) => setFormData({ ...formData, folderName: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-900"
                    required
                  >
                    <option value="">Select a folder</option>
                    {modalFolderOptions.map((folder) => {
                      const assignedMapping = folderAssignments.get(normalizeFolderName(folder));
                      const isCurrentEditingMapping = assignedMapping?._id === editingMapping?._id;
                      const assignmentLabel = assignedMapping
                        ? isCurrentEditingMapping
                          ? `Current mapping for ${assignedMapping.customerId.name}`
                          : `Mapped to ${assignedMapping.customerId.name}`
                        : 'Unmapped';

                      return (
                        <option key={folder} value={folder}>
                          {folder} - {assignmentLabel}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.folderName}
                    onChange={(e) => setFormData({ ...formData, folderName: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                    placeholder="e.g. Fletcher"
                    required
                  />
                )}
                {formData.folderName && (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                      <span className="font-medium">Selected folder:</span> {formData.folderName}
                    </div>
                    {selectedFolderMapping ? (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <span className="font-medium">Currently mapped to:</span>{' '}
                        {selectedFolderMapping.customerId.name}
                        {selectedFolderMapping.customerId.email ? ` (${selectedFolderMapping.customerId.email})` : ''}
                        {selectedFolderMapping._id === editingMapping?._id ? ' - this mapping' : ''}
                      </div>
                    ) : (
                      <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                        This folder is not mapped to any clinic yet.
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Refresh folders first if the clinic folder is not showing yet.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white"
                  rows={3}
                  placeholder="Optional admin note"
                />
              </div>

              <div>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingMapping ? 'Update Mapping' : 'Create Mapping'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
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
