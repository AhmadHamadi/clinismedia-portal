import { useState } from 'react';

interface MediaDayRequest {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  status: 'pending' | 'accepted' | 'denied';
  denialReason?: string;
}

export const useAdminMediaDayBooking = () => {
  // Mock data for media day requests
  const mockRequests: MediaDayRequest[] = [
    {
      id: '1',
      customerName: 'John Smith',
      email: 'john.smith@example.com',
      phone: '+1-555-555-5555',
      date: '2024-04-15',
      time: '10:00 AM',
      location: 'New York',
      notes: 'Would like to discuss product photography options',
      status: 'pending'
    },
    {
      id: '2',
      customerName: 'Sarah Johnson',
      email: 'sarah.johnson@example.com',
      phone: '+1-555-555-5555',
      date: '2024-04-18',
      time: '2:00 PM',
      location: 'Los Angeles',
      notes: 'Need video content for social media campaign',
      status: 'pending'
    },
    {
      id: '3',
      customerName: 'Michael Brown',
      email: 'michael.brown@example.com',
      phone: '+1-555-555-5555',
      date: '2024-04-20',
      time: '11:00 AM',
      location: 'Chicago',
      notes: '',
      status: 'accepted'
    },
    {
      id: '4',
      customerName: 'Emily Davis',
      email: 'emily.davis@example.com',
      phone: '+1-555-555-5555',
      date: '2025-06-15',
      time: '2:00 PM',
      location: 'San Francisco',
      notes: 'Product launch photoshoot',
      status: 'accepted'
    }
  ];

  const [requests, setRequests] = useState<MediaDayRequest[]>(mockRequests);
  const [selectedRequest, setSelectedRequest] = useState<MediaDayRequest | null>(null);
  const [isDenyModalOpen, setIsDenyModalOpen] = useState(false);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [denialReason, setDenialReason] = useState('');
  const [showPriorRequests, setShowPriorRequests] = useState(false);

  const handleAcceptRequest = (requestId: string) => {
    setRequests(requests.map(request =>
      request.id === requestId
        ? { ...request, status: 'accepted' }
        : request
    ));
    setIsAcceptModalOpen(false);
    setSelectedRequest(null);
  };

  const handleDenyRequest = (requestId: string) => {
    if (!denialReason.trim()) return;
    
    setRequests(requests.map(request => 
      request.id === requestId 
        ? { ...request, status: 'denied', denialReason }
        : request
    ));
    
    setDenialReason('');
    setIsDenyModalOpen(false);
    setSelectedRequest(null);
  };

  const openDenyModal = (request: MediaDayRequest) => {
    setSelectedRequest(request);
    setIsDenyModalOpen(true);
  };

  const openAcceptModal = (request: MediaDayRequest) => {
    setSelectedRequest(request);
    setIsAcceptModalOpen(true);
  };

  // Filter requests based on status and showPriorRequests state
  const filteredRequests = requests.filter(request => 
    showPriorRequests 
      ? request.status !== 'pending'  // Show accepted/denied requests
      : request.status === 'pending'  // Show pending requests
  );

  // Convert requests to calendar events
  const calendarEvents = requests.map(request => {
    const [hours, minutes] = request.time.split(':');
    const date = new Date(request.date);
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    return {
      id: request.id,
      title: `${request.customerName} - ${request.status}`,
      start: date,
      end: new Date(date.getTime() + 60 * 60 * 1000), // 1 hour duration
      status: request.status
    };
  });

  return {
    requests: filteredRequests,
    calendarEvents,
    isDenyModalOpen,
    isAcceptModalOpen,
    selectedRequest,
    setSelectedRequest,
    denialReason,
    setDenialReason,
    handleAcceptRequest,
    handleDenyRequest,
    openDenyModal,
    openAcceptModal,
    setIsDenyModalOpen,
    setIsAcceptModalOpen,
    showPriorRequests,
    setShowPriorRequests
  };
};
