import React, { useState, useRef, useEffect } from 'react';
import { FaPhone, FaSpinner, FaSyncAlt, FaCheckCircle, FaTimesCircle, FaUnlink, FaEdit, FaTimes, FaVolumeUp, FaStop } from 'react-icons/fa';
import { useTwilioManagement, Customer, TwilioPhoneNumber } from './TwilioManagementLogic';
import axios from 'axios';

// Sample text to play for voice preview
const VOICE_SAMPLE_TEXT = "Thank you for calling. Press 1 for new patients, press 2 for existing patients.";

// Valid Twilio voice names (100% VERIFIED - From Twilio Console Text-to-Speech)
// Format: <Provider>.<Voice> where Provider is "Polly" or "Google" and Voice is exact value from console
// Rule: Provider from console (Amazon Polly → Polly, Google Text-to-Speech → Google)
//       Voice from dropdown (e.g. "en-US-Chirp3-HD-Aoede", "Joanna-Generative")
//       Combined: Google.en-US-Chirp3-HD-Aoede or Polly.Joanna-Generative
const TWILIO_VOICES = [
  {
    category: '⭐ Amazon Polly Generative (Best Quality - Most Natural)',
    voices: [
      { value: 'Polly.Danielle-Generative', label: '🏆 Danielle-Generative - Female (BEST: Most Natural)', description: '⭐ BEST OVERALL - Most natural female voice, perfect for medical clinics' },
      { value: 'Polly.Joanna-Generative', label: '🏆 Joanna-Generative - Female (Excellent: Professional, Warm)', description: 'Excellent quality - professional, warm female voice' },
      { value: 'Polly.Matthew-Generative', label: 'Matthew-Generative - Male (Natural, Professional)', description: 'Very natural - professional male voice' },
      { value: 'Polly.Ruth-Generative', label: 'Ruth-Generative - Female (Natural, Friendly)', description: 'Very natural - friendly, clear female voice' },
      { value: 'Polly.Stephen-Generative', label: '🏆 Stephen-Generative - Male (BEST: Calm, Trustworthy)', description: '⭐ BEST MALE - Most natural male voice, calm and trustworthy' },
    ]
  },
  {
    category: 'Amazon Polly Neural (High Quality)',
    voices: [
      { value: 'Polly.Danielle-Neural', label: 'Danielle-Neural - Female (High Quality)', description: 'High quality neural female voice' },
      { value: 'Polly.Gregory-Neural', label: 'Gregory-Neural - Male (High Quality)', description: 'High quality neural male voice' },
      { value: 'Polly.Ivy-Neural', label: 'Ivy-Neural - Female Child (Young Voice)', description: 'Child voice - use for pediatric clinics' },
      { value: 'Polly.Joanna-Neural', label: 'Joanna-Neural - Female (Professional)', description: 'Professional female voice - neural quality' },
      { value: 'Polly.Joey-Neural', label: 'Joey-Neural - Male (Young, Casual)', description: 'Young, casual male voice - neural quality' },
      { value: 'Polly.Justin-Neural', label: 'Justin-Neural - Male (Young, Professional)', description: 'Young, professional male voice - neural quality' },
      { value: 'Polly.Kendra-Neural', label: 'Kendra-Neural - Female (Young, Energetic)', description: 'Young, energetic female voice - neural quality' },
      { value: 'Polly.Kevin-Neural', label: 'Kevin-Neural - Male (Young, Friendly)', description: 'Young, friendly male voice - neural quality' },
      { value: 'Polly.Kimberly-Neural', label: 'Kimberly-Neural - Female (Professional, Mature)', description: 'Professional, mature female voice - neural quality' },
    ]
  },
  {
    category: 'Amazon Polly Standard (Standard Quality)',
    voices: [
      { value: 'Polly.Joey', label: 'Joey - Male (Standard Quality)', description: 'Standard quality male voice' },
      { value: 'Polly.Justin', label: 'Justin - Male (Standard Quality)', description: 'Standard quality male voice' },
      { value: 'Polly.Kendra', label: 'Kendra - Female (Standard Quality)', description: 'Standard quality female voice' },
      { value: 'Polly.Kevin', label: 'Kevin - Male (Standard Quality)', description: 'Standard quality male voice' },
      { value: 'Polly.Kimberly', label: 'Kimberly - Female (Standard Quality)', description: 'Standard quality female voice' },
      { value: 'Polly.Matthew', label: 'Matthew - Male (Standard Quality)', description: 'Standard quality male voice' },
      { value: 'Polly.Salli', label: 'Salli - Female (Standard Quality)', description: 'Standard quality female voice' },
    ]
  },
  {
    category: 'Google Text-to-Speech (Chirp3 HD - High Quality)',
    voices: [
      { value: 'Google.en-US-Chirp3-HD-Aoede', label: '🏆 Chirp3 HD Aoede - Female (Google HD Voice)', description: '⭐ GOOGLE HD - High quality Google Chirp3 HD voice, very natural' },
    ]
  },
  {
    category: 'Basic Twilio Voices (Legacy - Not Recommended)',
    voices: [
      { value: 'alice', label: 'Alice - Basic Female (Legacy)', description: 'Legacy basic female voice - not recommended' },
      { value: 'woman', label: 'Woman - Basic Female (Legacy)', description: 'Legacy basic female voice - not recommended' },
      { value: 'man', label: 'Man - Basic Male (Legacy)', description: 'Legacy basic male voice - not recommended' },
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
        connection.voice || undefined
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
        voice: prev[customerId]?.voice || customer?.twilioVoice || 'Polly.Danielle-Generative',
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
        voice: prev[customerId]?.voice || customer?.twilioVoice || 'Polly.Danielle-Generative',
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
        voice: prev[customerId]?.voice || customer?.twilioVoice || 'Polly.Danielle-Generative',
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
        voice: prev[customerId]?.voice || customer?.twilioVoice || 'Polly.Danielle-Generative',
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
        voice: prev[customerId]?.voice || customer?.twilioVoice || 'Polly.Danielle-Generative',
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
      
      // For Polly and Google voices, try to match gender
      if (voiceValue.startsWith('Polly.') || voiceValue.startsWith('Google.')) {
        const voices = synth.getVoices();
        // For Polly and Google voices, try to match gender
        const isFemale = voiceValue.includes('Danielle') || voiceValue.includes('Joanna') || 
                        voiceValue.includes('Ruth') || voiceValue.includes('Kendra') || 
                        voiceValue.includes('Kimberly') || voiceValue.includes('Ivy') ||
                        voiceValue.includes('Salli') || voiceValue.includes('Aoede');
        const isMale = voiceValue.includes('Matthew') || voiceValue.includes('Stephen') || 
                       voiceValue.includes('Joey') || voiceValue.includes('Justin') ||
                       voiceValue.includes('Kevin') || voiceValue.includes('Gregory');
        
        const selectedVoice = voices.find(v => {
          const name = v.name.toLowerCase();
          if (isFemale) {
            return name.includes('female') || name.includes('samantha') || name.includes('susan') || 
                   name.includes('karen') || name.includes('victoria') || name.includes('zira') ||
                   name.includes('ruth') || name.includes('kendra');
          } else if (isMale) {
            return name.includes('male') || name.includes('david') || name.includes('mark') ||
                   name.includes('richard') || name.includes('james') || name.includes('alex') ||
                   name.includes('matthew') || name.includes('stephen');
          }
          // Fallback for unknown voices
          return v.lang.startsWith('en');
        }) || voices.find(v => v.lang.startsWith('en'));
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        utterance.rate = 0.9;
        utterance.pitch = isFemale ? 1.1 : 0.9;
      } else {
        // Basic voices
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
                              {customer.twilioVoice || 'Polly.Danielle-Generative'}
                              <button
                                onClick={() => playVoiceSample(customer.twilioVoice || 'Polly.Danielle-Generative')}
                                className="text-blue-600 hover:text-blue-800 p-0.5"
                                title="Play voice sample"
                                disabled={playingVoice === (customer.twilioVoice || 'Polly.Danielle-Generative')}
                              >
                                {playingVoice === (customer.twilioVoice || 'Polly.Danielle-Generative') ? (
                                  <FaStop className="text-xs" />
                                ) : (
                                  <FaVolumeUp className="text-xs" />
                                )}
                              </button>
                            </div>
                            <div className="text-gray-500 text-xs mt-0.5">
                              {FLATTENED_VOICES.find(v => v.value === (customer.twilioVoice || 'Polly.Danielle-Generative'))?.description || 'Default voice (Most Natural)'}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <select
                              className="border rounded px-1.5 py-1 w-full text-xs"
                              value={selectedConnections[customer._id]?.voice || customer.twilioVoice || 'Polly.Danielle-Generative'}
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
                                onClick={() => playVoiceSample(selectedConnections[customer._id]?.voice || customer.twilioVoice || 'Polly.Danielle-Generative')}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-1.5 py-0.5 border border-blue-300 rounded hover:bg-blue-50"
                                title="Play voice sample"
                                disabled={isConnecting || playingVoice === (selectedConnections[customer._id]?.voice || customer.twilioVoice || 'Polly.Danielle-Generative')}
                              >
                                {playingVoice === (selectedConnections[customer._id]?.voice || customer.twilioVoice || 'Polly.Danielle-Generative') ? (
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
                                {FLATTENED_VOICES.find(v => v.value === (selectedConnections[customer._id]?.voice || customer.twilioVoice || 'Polly.Danielle-Generative'))?.description || ''}
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

