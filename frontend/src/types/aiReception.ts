export type BusinessHoursDay = {
  enabled: boolean;
  start: string;
  end: string;
};

export type BusinessHoursMap = {
  monday: BusinessHoursDay;
  tuesday: BusinessHoursDay;
  wednesday: BusinessHoursDay;
  thursday: BusinessHoursDay;
  friday: BusinessHoursDay;
  saturday: BusinessHoursDay;
  sunday: BusinessHoursDay;
};

export type AiReceptionistSettings = {
  enabled: boolean;
  provider: "retell";
  routingMode: "off" | "after_hours" | "always_ai";
  telephonyMode: "sip_uri" | "phone_number" | "custom";
  retellAgentId: string | null;
  retellSipUri: string | null;
  retellPhoneNumber: string | null;
  timezone: string;
  sendMissedCallsToAi: boolean;
  afterHoursMessage: string | null;
  businessHours: BusinessHoursMap;
};

export const defaultAiReceptionistSettings = (): AiReceptionistSettings => ({
  enabled: false,
  provider: "retell",
  routingMode: "off",
  telephonyMode: "sip_uri",
  retellAgentId: null,
  retellSipUri: null,
  retellPhoneNumber: null,
  timezone: "America/Toronto",
  sendMissedCallsToAi: false,
  afterHoursMessage: null,
  businessHours: {
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: false, start: "09:00", end: "17:00" },
    saturday: { enabled: false, start: "09:00", end: "17:00" },
    sunday: { enabled: false, start: "09:00", end: "17:00" },
  },
});

export const businessHoursOrder: Array<keyof BusinessHoursMap> = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const formatDayLabel = (day: keyof BusinessHoursMap) =>
  day.charAt(0).toUpperCase() + day.slice(1);
