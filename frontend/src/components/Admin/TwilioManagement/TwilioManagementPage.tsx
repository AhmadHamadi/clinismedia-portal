import React, { useState, useRef, useEffect } from 'react';
import { FaPhone, FaSpinner, FaSyncAlt, FaCheckCircle, FaTimesCircle, FaUnlink, FaEdit, FaTimes, FaVolumeUp, FaStop, FaTrash } from 'react-icons/fa';
import { useTwilioManagement, Customer, TwilioPhoneNumber } from './TwilioManagementLogic';
import axios from 'axios';

// ============================================
// Twilio TTS Voice Configuration
// ============================================
// SINGLE HARD-CODED VOICE FOR ALL CLINICS
// Provider: Google Text-to-Speech
// Voice from dropdown: en-US-Chirp3-HD-Aoede
// Final format: Google.en-US-Chirp3-HD-Aoede
// ============================================

// ✅ Single, hard-coded voice constant - NEVER use env vars for this
const TTS_VOICE = 'Google.en-US-Chirp3-HD-Aoede';

// Sample text to play for voice preview
const VOICE_SAMPLE_TEXT = "Thank you for calling. Press 1 for new patients, press 2 for existing patients.";

// Valid Twilio voice names (100% VERIFIED - From Twilio Console Text-to-Speech)
const TWILIO_VOICES = [
  {
    category: 'Google Text-to-Speech',
    voices: [
      { value: TTS_VOICE, label: 'Chirp3 HD Aoede - Female (Google HD Voice)', description: 'High quality Google Chirp3 HD voice, very natural' },
    ]
  },
];

// Flatten voices for dropdown (with category prefix for display)
const FLATTENED_VOICES = TWILIO_VOICES.flatMap(category => 
  category.voices.map(voice => ({
    ...voice,
    category: category.category,
    displayLabel: `[${category.category}] ${voice.label}`
  }))
);

const TwilioManagementPage: React.FC = () => {
  const {
    customers,
    phoneNumbers,
    loading,
    error,
    connecting,
    fetchCustomers,
    fetchPhoneNumbers,
    connectPhoneNumber,
    disconnectPhoneNumber,
    getTwilioStatus,
  } = useTwilioManagement();

  const [selectedConnections, setSelectedConnections] = useState<{ 
    [customerId: string]: { 
      phoneNumber: string; 
      forwardNumber: string;
      forwardNumberNew: string;
      forwardNumberExisting: string;
      menuMessage: string;
      voice: string;
    } 
  }>({});
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showMenuFields, setShowMenuFields] = useState(true); // Assume menu is enabled by default
  const [editingMessage, setEditingMessage] = useState<string | null>(null); // Clinic ID being edited
  const [editingMessageValue, setEditingMessageValue] = useState<string>('');
  const [updatingMessage, setUpdatingMessage] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null); // Voice value currently playing
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Most Natural (AI Voices)'])); // Categories expanded by default
  const [deletingLogs, setDeletingLogs] = useState<string | null>(null); // Customer ID currently deleting logs
  const synthRef = useRef<SpeechSynthesis | null>(null);

  const handleConnect = async (customer: Customer) => {
    const connection = selectedConnections[customer._id];
    if (!connection) {
      setConnectError('Please select a phone number and enter at least one forward number');
      return;
    }

    // At least one forward number must be provided
    const forwardNum = connection.forwardNumber || connection.forwardNumberNew || connection.forwardNumberExisting;
    if (!forwardNum) {
      setConnectError('Please enter a forward number');
      return;
    }

    try {
      setConnectError(null);
      await connectPhoneNumber(
        customer._id, 
        connection.phoneNumber, 
        connection.forwardNumber || undefined,
        connection.forwardNumberNew || undefined,
        connection.forwardNumberExisting || undefined,
        connection.menuMessage || undefined,
        connection.voice || TTS_VOICE  // ✅ Always send TTS_VOICE if not set
      );
      setSelectedConnections(prev => {
        const next = { ...prev };
        delete next[customer._id];
        return next;
      });
    } catch (err: any) {
      setConnectError(err.message || 'Failed to connect phone number');
    }
  };

  const handleDisconnect = async (customer: Customer) => {
    if (window.confirm(`Are you sure you want to disconnect ${customer.twilioPhoneNumber} from ${customer.name}?`)) {
      try {
        await disconnectPhoneNumber(customer._id);
      } catch (err) {
        // Error is handled in the hook
      }
    }
  };

  const handlePhoneNumberChange = (customerId: string, phoneNumber: string) => {
    // Get the customer to use their name in the default message
    const customer = customers.find(c => c._id === customerId);
    const defaultMessage = customer 
      ? `Thank you for calling ${customer.name}. Press 1 for new patients, press 2 for existing patients.`
      : '';
    
    setSelectedConnections(prev => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        phoneNumber,
        forwardNumber: prev[customerId]?.forwardNumber || '',
        forwardNumberNew: prev[customerId]?.forwardNumberNew || '',
        forwardNumberExisting: prev[customerId]?.forwardNumberExisting || '',
        // Pre-fill with default message if not already set
        menuMessage: prev[customerId]?.menuMessage || defaultMessage,
        voice: prev[customerId]?.voice || customer?.twilioVoice || TTS_VOICE,
      },
    }));
  };

  const handleForwardNumberChange = (customerId: string, forwardNumber: string) => {
    const customer = customers.find(c => c._id === customerId);
    setSelectedConnections(prev => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        phoneNumber: prev[customerId]?.phoneNumber || '',
        forwardNumber,
        forwardNumberNew: prev[customerId]?.forwardNumberNew || '',
        forwardNumberExisting: prev[customerId]?.forwardNumberExisting || '',
        menuMessage: prev[customerId]?.menuMessage || '',
        voice: prev[customerId]?.voice || customer?.twilioVoice || TTS_VOICE,
      },
    }));
  };

  const handleForwardNumberNewChange = (customerId: string, forwardNumberNew: string) => {
    const customer = customers.find(c => c._id === customerId);
    setSelectedConnections(prev => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        phoneNumber: prev[customerId]?.phoneNumber || '',
        forwardNumber: prev[customerId]?.forwardNumber || '',
        forwardNumberNew,
        forwardNumberExisting: prev[customerId]?.forwardNumberExisting || '',
        menuMessage: prev[customerId]?.menuMessage || '',
        voice: prev[customerId]?.voice || customer?.twilioVoice || TTS_VOICE,
      },
    }));
  };

  const handleForwardNumberExistingChange = (customerId: string, forwardNumberExisting: string) => {
    const customer = customers.find(c => c._id === customerId);
    setSelectedConnections(prev => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        phoneNumber: prev[customerId]?.phoneNumber || '',
        forwardNumber: prev[customerId]?.forwardNumber || '',
        forwardNumberNew: prev[customerId]?.forwardNumberNew || '',
        forwardNumberExisting,
        menuMessage: prev[customerId]?.menuMessage || '',
        voice: prev[customerId]?.voice || customer?.twilioVoice || TTS_VOICE,
      },
    }));
  };

  const handleMenuMessageChange = (customerId: string, menuMessage: string) => {
    const customer = customers.find(c => c._id === customerId);
    setSelectedConnections(prev => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        phoneNumber: prev[customerId]?.phoneNumber || '',
        forwardNumber: prev[customerId]?.forwardNumber || '',
        forwardNumberNew: prev[customerId]?.forwardNumberNew || '',
        forwardNumberExisting: prev[customerId]?.forwardNumberExisting || '',
        menuMessage,
        voice: prev[customerId]?.voice || customer?.twilioVoice || TTS_VOICE,
      },
    }));
  };

  const handleVoiceChange = (customerId: string, voice: string) => {
    setSelectedConnections(prev => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        phoneNumber: prev[customerId]?.phoneNumber || '',
        forwardNumber: prev[customerId]?.forwardNumber || '',
        forwardNumberNew: prev[customerId]?.forwardNumberNew || '',
        forwardNumberExisting: prev[customerId]?.forwardNumberExisting || '',
        menuMessage: prev[customerId]?.menuMessage || '',
        voice,
      },
    }));
  };

  const handleEditMessage = (customer: Customer) => {
    // Get the current message or generate default
    const currentMessage = customer.twilioMenuMessage || `Thank you for calling ${customer.name}. Press 1 for new patients, press 2 for existing patients.`;
    setEditingMessage(customer._id);
    setEditingMessageValue(currentMessage);
  };

  const handleCancelEditMessage = () => {
    setEditingMessage(null);
    setEditingMessageValue('');
  };

  const handleSaveMessage = async (customerId: string) => {
    try {
      setUpdatingMessage(customerId);
      const token = localStorage.getItem('adminToken');
      
      // If message is empty or just whitespace, send null to reset to default
      const messageToSave = editingMessageValue.trim() || null;
      
      await axios.patch(
        `${import.meta.env.VITE_API_BASE_URL}/twilio/update-message/${customerId}`,
        { menuMessage: messageToSave },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh customers to get updated message
      await fetchCustomers();
      setEditingMessage(null);
      setEditingMessageValue('');
    } catch (err: any) {
      console.error('Failed to update message:', err);
      alert(err.response?.data?.error || 'Failed to update message');
    } finally {
      setUpdatingMessage(null);
    }
  };

  // Play voice sample using Web Speech API
  const playVoiceSample = (voiceValue: string) => {
    // Stop any currently playing voice
    if (synthRef.current) {
      synthRef.current.cancel();
    }

    // Initialize speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const synth = window.speechSynthesis;
      synthRef.current = synth;

      // Map Twilio voices to browser voices
      const utterance = new SpeechSynthesisUtterance(VOICE_SAMPLE_TEXT);
      
      // Google Chirp3 HD Aoede is a female voice - use high-quality female browser voice for preview
      if (voiceValue.startsWith('Google.')) {
        const voices = synth.getVoices();
        // Find a high-quality female voice for preview
        const selectedVoice = voices.find(v => {
          const name = v.name.toLowerCase();
          return name.includes('female') || name.includes('samantha') || name.includes('susan') || 
                 name.includes('karen') || name.includes('victoria') || name.includes('zira');
        }) || voices.find(v => v.lang.startsWith('en'));
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.rate = 0.9;
        utterance.pitch = 1.1; // Female voice pitch
      } else {
        // Fallback for any other voices
        const voices = synth.getVoices();
        const selectedVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
      }

      utterance.lang = 'en-US';
      utterance.volume = 1;
      
      utterance.onend = () => {
        setPlayingVoice(null);
      };
      
      utterance.onerror = () => {
        setPlayingVoice(null);
      };

      setPlayingVoice(voiceValue);
      synth.speak(utterance);
    } else {
      alert('Speech synthesis is not supported in your browser. Please use a modern browser like Chrome, Firefox, or Edge.');
    }
  };

  const stopVoiceSample = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setPlayingVoice(null);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handleDeleteAllLogs = async (customer: Customer) => {
    // Confirmation dialog
    const confirmMessage = `Are you sure you want to delete ALL call logs for ${customer.name}?\n\nThis action cannot be undone and will delete all call history, recordings, and statistics for this clinic.`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    // Double confirmation
    const doubleConfirm = window.confirm(`FINAL CONFIRMATION: Delete ALL call logs for ${customer.name}?\n\nThis will permanently delete all call history.`);
    
    if (!doubleConfirm) {
      return;
    }
    
    try {
      setDeletingLogs(customer._id);
      const token = localStorage.getItem('adminToken');
      
      const response = await axios.delete(
        `${import.meta.env.VITE_API_BASE_URL}/twilio/call-logs/${customer._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert(`Successfully deleted ${response.data.deletedCount} call log${response.data.deletedCount !== 1 ? 's' : ''} for ${customer.name}`);
      
      // Optionally refresh the page or update UI
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to delete call logs:', err);
      alert(err.response?.data?.error || 'Failed to delete call logs');
    } finally {
      setDeletingLogs(null);
    }
  };

  const availablePhoneNumbers = phoneNumbers.filter(num => !num.assigned);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-[#98c6d5] mx-auto mb-4" />
          <p className="text-gray-600">Loading Twilio management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center">
            <FaPhone className="text-2xl text-[#98c6d5] mr-2" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Twilio Call Management</h1>
              <p className="text-xs text-gray-600">Connect phone numbers to clinics and manage call forwarding</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                fetchCustomers();
                fetchPhoneNumbers();
              }}
              className="flex items-center px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-semibold hover:bg-gray-300"
              title="Refresh customer list and phone numbers"
            >
              <FaSyncAlt className="mr-1 text-xs" /> Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-3 bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* Phone Numbers Summary */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="bg-white rounded-lg shadow-md p-3">
            <div className="text-xs text-gray-600">Total Phone Numbers</div>
            <div className="text-lg font-bold text-gray-900">{phoneNumbers.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3">
            <div className="text-xs text-gray-600">Available</div>
            <div className="text-lg font-bold text-green-600">{availablePhoneNumbers.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-3">
            <div className="text-xs text-gray-600">Assigned</div>
            <div className="text-lg font-bold text-blue-600">{phoneNumbers.filter(n => n.assigned).length}</div>
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Clinic Phone Number Assignments</h2>
            <p className="text-xs text-gray-600 mt-1">
              {customers.length} clinic{customers.length !== 1 ? 's' : ''} found
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200" style={{ tableLayout: 'auto' }}>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>
                    Clinic
                  </th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '12%' }}>
                    Location
                  </th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>
                    Twilio Number
                  </th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '25%' }}>
                    Forward Numbers
                  </th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '15%' }}>
                    Voice
                  </th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                    Status
                  </th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: '10%' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => {
                  const status = getTwilioStatus(customer);
                  const isConnecting = connecting === customer._id;
                  
                  return (
                    <tr key={customer._id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5" style={{ width: '15%' }}>
                        <div>
                          <div className="text-xs font-medium text-gray-900 truncate" title={customer.name}>{customer.name}</div>
                          <div className="text-xs text-gray-500 truncate" title={customer.email}>{customer.email}</div>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-900 whitespace-nowrap" style={{ width: '12%' }}>
                        {customer.location || 'N/A'}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-900" style={{ width: '15%' }}>
                        {status.connected ? (
                          <span className="font-mono text-xs">{status.phoneNumber}</span>
                        ) : (
                          <select
                            className="border rounded px-1.5 py-1 w-full text-xs"
                            value={selectedConnections[customer._id]?.phoneNumber || customer.twilioPhoneNumber || ''}
                            onChange={(e) => handlePhoneNumberChange(customer._id, e.target.value)}
                            disabled={isConnecting || availablePhoneNumbers.length === 0}
                          >
                            <option value="">Select...</option>
                            {availablePhoneNumbers.map((num) => (
                              <option key={num.sid} value={num.phoneNumber}>
                                {num.phoneNumber}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-900" style={{ width: '30%' }}>
                        {status.connected ? (
                          <div className="space-y-1">
                            <div className="font-mono text-xs truncate" title={customer.twilioForwardNumberNew || customer.twilioForwardNumberExisting || customer.twilioForwardNumber || 'N/A'}>
                              {customer.twilioForwardNumberNew || customer.twilioForwardNumberExisting || customer.twilioForwardNumber || 'N/A'}
                            </div>
                            {editingMessage === customer._id ? (
                              <div className="space-y-1">
                                <textarea
                                  className="border rounded px-1.5 py-1 w-full text-xs resize-none"
                                  rows={3}
                                  value={editingMessageValue}
                                  onChange={(e) => setEditingMessageValue(e.target.value)}
                                  disabled={updatingMessage === customer._id}
                                  placeholder={`Thank you for calling ${customer.name}. Press 1 for new patients, press 2 for existing patients.`}
                                />
                                <p className="text-xs text-gray-500">
                                  Leave empty to use default message with clinic name
                                </p>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleSaveMessage(customer._id)}
                                    disabled={updatingMessage === customer._id}
                                    className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                                  >
                                    {updatingMessage === customer._id ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={handleCancelEditMessage}
                                    disabled={updatingMessage === customer._id}
                                    className="px-2 py-0.5 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:bg-gray-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-1">
                                <div className="flex-1 min-w-0">
                                  <div 
                                    className="text-xs text-gray-600 truncate" 
                                    title={customer.twilioMenuMessage || `Thank you for calling ${customer.name}. Press 1 for new patients, press 2 for existing patients.`}
                                  >
                                    "{customer.twilioMenuMessage 
                                      ? (customer.twilioMenuMessage.length > 40 ? customer.twilioMenuMessage.substring(0, 40) + '...' : customer.twilioMenuMessage)
                                      : `Thank you for calling ${customer.name}. Press 1 for new patients, press 2 for existing patients.`.substring(0, 40) + '...'
                                    }"
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleEditMessage(customer)}
                                  className="flex-shrink-0 p-0.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                  title="View and edit full message"
                                >
                                  <FaEdit className="text-xs" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <input
                              type="text"
                              placeholder="+14165551234"
                              className="border rounded px-1.5 py-0.5 w-full text-xs font-mono"
                              value={selectedConnections[customer._id]?.forwardNumber || selectedConnections[customer._id]?.forwardNumberNew || selectedConnections[customer._id]?.forwardNumberExisting || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                handleForwardNumberChange(customer._id, value);
                                handleForwardNumberNewChange(customer._id, value);
                                handleForwardNumberExistingChange(customer._id, value);
                              }}
                              disabled={isConnecting}
                            />
                             <textarea
                               placeholder="Custom message (optional)"
                               className="border rounded px-1.5 py-0.5 w-full text-xs resize-none"
                               rows={2}
                               value={selectedConnections[customer._id]?.menuMessage || `Thank you for calling ${customer.name}. Press 1 for new patients, press 2 for existing patients.`}
                               onChange={(e) => handleMenuMessageChange(customer._id, e.target.value)}
                               disabled={isConnecting}
                             />
                             <p className="text-xs text-gray-500 mt-0.5">
                               Default message includes clinic name. Edit as needed.
                             </p>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-900" style={{ width: '15%' }}>
                        {status.connected ? (
                          <div className="text-xs">
                            <div className="font-medium flex items-center gap-1">
                              {customer.twilioVoice || TTS_VOICE}
                              <button
                                onClick={() => playVoiceSample(customer.twilioVoice || TTS_VOICE)}
                                className="text-blue-600 hover:text-blue-800 p-0.5"
                                title="Play voice sample"
                                disabled={playingVoice === (customer.twilioVoice || TTS_VOICE)}
                              >
                                {playingVoice === (customer.twilioVoice || TTS_VOICE) ? (
                                  <FaStop className="text-xs" />
                                ) : (
                                  <FaVolumeUp className="text-xs" />
                                )}
                              </button>
                            </div>
                            <div className="text-gray-500 text-xs mt-0.5">
                              {FLATTENED_VOICES.find(v => v.value === (customer.twilioVoice || TTS_VOICE))?.description || 'Default voice (Google Chirp3 HD)'}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <select
                              className="border rounded px-1.5 py-1 w-full text-xs"
                              value={selectedConnections[customer._id]?.voice || customer.twilioVoice || TTS_VOICE}
                              onChange={(e) => handleVoiceChange(customer._id, e.target.value)}
                              disabled={isConnecting}
                            >
                              {TWILIO_VOICES.map((category) => (
                                <optgroup key={category.category} label={category.category}>
                                  {category.voices.map((voice) => (
                                    <option key={voice.value} value={voice.value}>
                                      {voice.label}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => playVoiceSample(selectedConnections[customer._id]?.voice || customer.twilioVoice || TTS_VOICE)}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-1.5 py-0.5 border border-blue-300 rounded hover:bg-blue-50"
                                title="Play voice sample"
                                disabled={isConnecting || playingVoice === (selectedConnections[customer._id]?.voice || customer.twilioVoice || TTS_VOICE)}
                              >
                                {playingVoice === (selectedConnections[customer._id]?.voice || customer.twilioVoice || TTS_VOICE) ? (
                                  <>
                                    <FaStop className="text-xs" /> Stop
                                  </>
                                ) : (
                                  <>
                                    <FaVolumeUp className="text-xs" /> Preview
                                  </>
                                )}
                              </button>
                              <span className="text-xs text-gray-500">
                                {FLATTENED_VOICES.find(v => v.value === (selectedConnections[customer._id]?.voice || customer.twilioVoice || TTS_VOICE))?.description || ''}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap" style={{ width: '10%' }}>
                        {status.connected ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <FaCheckCircle className="mr-0.5 text-xs" /> Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            <FaTimesCircle className="mr-0.5 text-xs" /> Not Connected
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium" style={{ width: '10%' }}>
                        <div className="flex flex-col gap-1">
                          {status.connected ? (
                            <button
                              onClick={() => handleDisconnect(customer)}
                              className="text-red-600 hover:text-red-900 text-xs"
                              disabled={isConnecting}
                              title="Disconnect"
                            >
                              <FaUnlink className="inline mr-0.5" /> Disconnect
                            </button>
                          ) : (
                            <button
                              onClick={() => handleConnect(customer)}
                              disabled={
                                isConnecting || 
                                !selectedConnections[customer._id]?.phoneNumber || 
                                (!selectedConnections[customer._id]?.forwardNumber && 
                                 !selectedConnections[customer._id]?.forwardNumberNew && 
                                 !selectedConnections[customer._id]?.forwardNumberExisting)
                              }
                              className="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed text-xs"
                              title="Connect"
                            >
                              {isConnecting ? (
                                <>
                                  <FaSpinner className="inline mr-0.5 animate-spin" /> Connecting...
                                </>
                              ) : (
                                'Connect'
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteAllLogs(customer)}
                            disabled={deletingLogs === customer._id}
                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 disabled:text-gray-300 disabled:cursor-not-allowed flex items-center gap-1 px-2 py-1 rounded border border-red-200 transition-colors mt-1"
                            title="Delete all call logs for this clinic"
                          >
                            {deletingLogs === customer._id ? (
                              <>
                                <FaSpinner className="inline animate-spin text-xs" /> Deleting...
                              </>
                            ) : (
                              <>
                                <FaTrash className="inline text-xs" /> Reset Logs
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {customers.length === 0 && (
            <div className="text-center py-12">
              <FaPhone className="text-4xl text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No clinics found</h3>
              <p className="text-gray-500">Add some clinics first to manage their phone number connections.</p>
            </div>
          )}
        </div>

        {/* Connect Error */}
        {connectError && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {connectError}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How it works</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Select Phone Number:</strong> Choose an available Twilio phone number from the dropdown.</p>
            <p>• <strong>Enter Forward Number:</strong> Enter the clinic's phone number where calls should be forwarded (E.164 format: +1XXXXXXXXXX).</p>
            <p>• <strong>Connect:</strong> Click "Connect" to assign the phone number to the clinic. Webhooks will be configured automatically.</p>
            <p>• <strong>Disconnect:</strong> Click "Disconnect" to remove the phone number assignment from a clinic.</p>
            <p>• <strong>Refresh:</strong> Use the refresh button to reload clinics and phone numbers.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwilioManagementPage;

