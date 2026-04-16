import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_BASE_URL;
const token = () => localStorage.getItem('adminToken') || '';

export interface BusinessHoursDay {
  enabled: boolean;
  start: string;
  end: string;
}

export interface AIReceptionistSettings {
  enabled: boolean;
  provider: string;
  routingMode: 'off' | 'after_hours' | 'always_ai';
  telephonyMode: 'sip_uri' | 'phone_number' | 'custom';
  retellAgentId: string | null;
  retellSipUri: string | null;
  retellPhoneNumber: string | null;
  timezone: string;
  sendMissedCallsToAi: boolean;
  afterHoursMessage: string | null;
  businessHours: Record<string, BusinessHoursDay>;
}

export interface Clinic {
  _id: string;
  name: string;
  email: string;
  twilioPhoneNumber?: string;
  aiReceptionistSettings?: AIReceptionistSettings;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIMEZONES = ['America/Toronto', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Vancouver'];

const defaultSettings = (): AIReceptionistSettings => ({
  enabled: false,
  provider: 'retell',
  routingMode: 'off',
  telephonyMode: 'sip_uri',
  retellAgentId: null,
  retellSipUri: null,
  retellPhoneNumber: null,
  timezone: 'America/Toronto',
  sendMissedCallsToAi: false,
  afterHoursMessage: null,
  businessHours: {
    monday:    { enabled: true,  start: '09:00', end: '17:00' },
    tuesday:   { enabled: true,  start: '09:00', end: '17:00' },
    wednesday: { enabled: true,  start: '09:00', end: '17:00' },
    thursday:  { enabled: true,  start: '09:00', end: '17:00' },
    friday:    { enabled: false, start: '09:00', end: '17:00' },
    saturday:  { enabled: false, start: '09:00', end: '17:00' },
    sunday:    { enabled: false, start: '09:00', end: '17:00' },
  },
});

export function useAIReceptionManagement() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [settings, setSettings] = useState<AIReceptionistSettings>(defaultSettings());
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingSettings, setIsFetchingSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchClinics = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await axios.get(`${API}/customers`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      setClinics(res.data);
    } catch {
      setErrorMsg('Failed to load clinics.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchClinics(); }, [fetchClinics]);

  const selectClinic = useCallback(async (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setSuccessMsg('');
    setErrorMsg('');
    setIsFetchingSettings(true);
    try {
      const res = await axios.get(`${API}/retell/settings/${clinic._id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      setSettings(res.data.aiReceptionistSettings ?? defaultSettings());
    } catch {
      setSettings(defaultSettings());
      setErrorMsg('Could not load settings for this clinic.');
    } finally {
      setIsFetchingSettings(false);
    }
  }, []);

  const updateDay = (day: string, field: keyof BusinessHoursDay, value: boolean | string) => {
    setSettings(prev => ({
      ...prev,
      businessHours: {
        ...prev.businessHours,
        [day]: { ...prev.businessHours[day], [field]: value },
      },
    }));
  };

  const handleSave = async () => {
    if (!selectedClinic) return;
    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await axios.put(
        `${API}/retell/settings/${selectedClinic._id}`,
        { aiReceptionistSettings: settings },
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      setSuccessMsg('AI reception settings saved successfully.');
      fetchClinics();
    } catch {
      setErrorMsg('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    clinics, selectedClinic, selectClinic,
    settings, setSettings, updateDay,
    handleSave,
    isLoading, isFetchingSettings, isSaving,
    successMsg, errorMsg,
    DAYS, TIMEZONES,
  };
}
