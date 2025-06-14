import { useState } from 'react';

export interface TimeSlot {
  id: string;
  time: string;
  isAvailable: boolean;
}

export const useMediaDayBooking = () => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [notes, setNotes] = useState('');

  // Generate time slots from 8 AM to 4 PM
  const timeSlots = [
    { id: 1, time: '10:00 AM' },
    { id: 2, time: '11:00 AM' },
    { id: 3, time: '12:00 PM' },
    { id: 4, time: '1:00 PM' },
    { id: 5, time: '2:00 PM' },
  ];

  const handleDateSelect = (date: Date) => {
    // Check if the date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    
    if (date < today) {
      return; // Don't allow selection of past dates
    }
    
    setSelectedDate(date);
    setIsTimeModalOpen(true);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
  };

  const handleSubmit = () => {
    if (selectedDate && selectedTime) {
      // Here you would typically make an API call to save the booking
      console.log('Booking submitted:', {
        date: selectedDate,
        time: selectedTime,
        notes: notes.trim() || undefined // Only include notes if they're not empty
      });
      
      // Reset form
      setSelectedDate(null);
      setSelectedTime(null);
      setNotes('');
      setIsTimeModalOpen(false);
    }
  };

  return {
    selectedDate,
    selectedTime,
    isTimeModalOpen,
    timeSlots,
    notes,
    handleDateSelect,
    handleTimeSelect,
    handleSubmit,
    setIsTimeModalOpen,
    setNotes
  };
};
