import { useState, useEffect } from "react";
import axios from "axios";

export interface Customer {
  _id: string;
  name: string;
  email: string;
  username?: string;
  location?: string;
  twilioPhoneNumber?: string;
  twilioForwardNumber?: string;
  twilioForwardNumberNew?: string;
  twilioForwardNumberExisting?: string;
  twilioMenuMessage?: string;
  twilioVoice?: string;
}

export interface TwilioPhoneNumber {
  phoneNumber: string;
  friendlyName: string;
  sid: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  assigned: boolean;
  assignedTo?: string;
}

export const useTwilioManagement = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<TwilioPhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data);
    } catch (err) {
      console.error("Failed to fetch customers", err);
      setError("Failed to fetch customers");
    }
  };

  const fetchPhoneNumbers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/twilio/numbers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPhoneNumbers(response.data.numbers || []);
    } catch (err: any) {
      console.error("Failed to fetch phone numbers", err);
      setError(err.response?.data?.error || "Failed to fetch Twilio phone numbers");
    } finally {
      setLoading(false);
    }
  };

  const connectPhoneNumber = async (
    clinicId: string, 
    phoneNumber: string, 
    forwardNumber?: string,
    forwardNumberNew?: string,
    forwardNumberExisting?: string,
    menuMessage?: string,
    voice?: string
  ) => {
    try {
      setConnecting(clinicId);
      const token = localStorage.getItem('adminToken');
      const response = await axios.post(`${import.meta.env.VITE_API_BASE_URL}/twilio/connect`, {
        clinicId,
        phoneNumber,
        forwardNumber,
        forwardNumberNew,
        forwardNumberExisting,
        menuMessage,
        voice,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update local state
      setCustomers(prev => prev.map(customer =>
        customer._id === clinicId
          ? {
              ...customer,
              twilioPhoneNumber: phoneNumber,
              twilioForwardNumber: forwardNumber || response.data.user.twilioForwardNumber,
              twilioForwardNumberNew: forwardNumberNew || response.data.user.twilioForwardNumberNew,
              twilioForwardNumberExisting: forwardNumberExisting || response.data.user.twilioForwardNumberExisting,
              twilioMenuMessage: menuMessage !== undefined ? menuMessage : response.data.user.twilioMenuMessage,
              twilioVoice: voice !== undefined ? voice : response.data.user.twilioVoice,
            }
          : customer
      ));

      // Refresh phone numbers to update assigned status
      await fetchPhoneNumbers();

      return response.data;
    } catch (err: any) {
      console.error("Failed to connect phone number", err);
      const errorMessage = err.response?.data?.error || "Failed to connect phone number";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setConnecting(null);
    }
  };

  const disconnectPhoneNumber = async (clinicId: string) => {
    try {
      const token = localStorage.getItem('adminToken');
      await axios.patch(`${import.meta.env.VITE_API_BASE_URL}/twilio/disconnect/${clinicId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Update local state
      setCustomers(prev => prev.map(customer =>
        customer._id === clinicId
          ? {
              ...customer,
              twilioPhoneNumber: undefined,
              twilioForwardNumber: undefined,
              twilioForwardNumberNew: undefined,
              twilioForwardNumberExisting: undefined,
              twilioMenuMessage: undefined,
            }
          : customer
      ));

      // Refresh phone numbers to update assigned status
      await fetchPhoneNumbers();
    } catch (err: any) {
      console.error("Failed to disconnect phone number", err);
      const errorMessage = err.response?.data?.error || "Failed to disconnect phone number";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getTwilioStatus = (customer: Customer) => {
    // Check if customer has a Twilio phone number and at least one forward number
    if (customer.twilioPhoneNumber && 
        (customer.twilioForwardNumber || customer.twilioForwardNumberNew || customer.twilioForwardNumberExisting)) {
      return {
        connected: true,
        phoneNumber: customer.twilioPhoneNumber,
        forwardNumber: customer.twilioForwardNumber || customer.twilioForwardNumberNew || customer.twilioForwardNumberExisting || 'N/A',
      };
    }
    return { connected: false };
  };

  useEffect(() => {
    fetchCustomers();
    fetchPhoneNumbers();
  }, []);

  return {
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
  };
};

