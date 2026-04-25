const mongoose = require("mongoose");

const defaultAiReceptionBusinessHours = () => ({
  monday: { enabled: true, start: "09:00", end: "17:00" },
  tuesday: { enabled: true, start: "09:00", end: "17:00" },
  wednesday: { enabled: true, start: "09:00", end: "17:00" },
  thursday: { enabled: true, start: "09:00", end: "17:00" },
  friday: { enabled: false, start: "09:00", end: "17:00" },
  saturday: { enabled: false, start: "09:00", end: "17:00" },
  sunday: { enabled: false, start: "09:00", end: "17:00" },
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  username: {
    type: String,
    required: true,
    unique: true,
  },
  
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["admin", "customer", "employee", "receptionist"],
    default: "customer",
  },
  parentCustomerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  canBookMediaDay: {
    type: Boolean,
    default: false,
  },
  location: {
    type: String,
    required: function () {
      return this.role === "customer";
    },
  },
  department: {
    type: String,
    enum: ["photography", "web", "social"],
    required: function () {
      return this.role === "employee";
    },
  },
  address: {
    type: String,
    default: '',
  },
  customerSettings: {
    displayName: String,
    logoUrl: String,
  },
  aiReceptionistSettings: {
    enabled: {
      type: Boolean,
      default: false,
    },
    provider: {
      type: String,
      enum: ["retell"],
      default: "retell",
    },
    routingMode: {
      type: String,
      enum: ["off", "after_hours", "always_ai"],
      default: "off",
    },
    telephonyMode: {
      type: String,
      enum: ["sip_uri", "phone_number", "custom"],
      default: "sip_uri",
    },
    retellAgentId: {
      type: String,
      default: null,
    },
    retellSipUri: {
      type: String,
      default: null,
    },
    retellPhoneNumber: {
      type: String,
      default: null,
    },
    timezone: {
      type: String,
      default: "America/Toronto",
    },
    sendMissedCallsToAi: {
      type: Boolean,
      default: false,
    },
    afterHoursMessage: {
      type: String,
      default: null,
    },
    businessHours: {
      type: Object,
      default: defaultAiReceptionBusinessHours,
    },
  },
  facebookPageId: {
    type: String,
    default: null,
  },
  facebookPageName: {
    type: String,
    default: null,
  },
  instagramAccountId: {
    type: String,
    default: null,
  },
  instagramAccountName: {
    type: String,
    default: null,
  },
  instagramUsername: {
    type: String,
    default: null,
  },
  facebookAccessToken: {
    type: String,
    default: null,
  },
  facebookTokenExpiry: {
    type: Date,
    default: null,
  },
  facebookUserAccessToken: {
    type: String,
    default: null,
  },
  facebookUserTokenExpiry: {
    type: Date,
    default: null,
  },
  facebookNeedsReauth: {
    type: Boolean,
    default: false,
  },
  googleAdsAccessToken: {
    type: String,
    default: null,
  },
  googleAdsRefreshToken: {
    type: String,
    default: null,
  },
  googleAdsTokenExpiry: {
    type: Date,
    default: null,
  },
  googleAdsCustomerId: {
    type: String,
    default: null,
  },
  googleAdsAccountName: {
    type: String,
    default: null,
  },
  googleAdsNeedsReauth: {
    type: Boolean,
    default: false,
  },
  googleBusinessProfileId: {
    type: String,
    default: null,
  },
  googleBusinessProfileName: {
    type: String,
    default: null,
  },
  googleBusinessAccountId: {
    type: String,
    default: null,
  },
  googleBusinessAccountName: {
    type: String,
    default: null,
  },
  googleBusinessLocationName: {
    type: String,
    default: null,
  },
  googleBusinessAccessToken: {
    type: String,
    default: null,
  },
  googleBusinessRefreshToken: {
    type: String,
    default: null,
  },
  googleBusinessTokenExpiry: {
    type: Date,
    default: null,
  },
  googleBusinessNeedsReauth: {
    type: Boolean,
    default: false,
  },
  websiteUrl: {
    type: String,
    default: null,
  },
  searchConsolePropertyUrl: {
    type: String,
    default: null,
  },
  searchConsoleAccessToken: {
    type: String,
    default: null,
  },
  searchConsoleRefreshToken: {
    type: String,
    default: null,
  },
  searchConsoleTokenExpiry: {
    type: Date,
    default: null,
  },
  searchConsoleNeedsReauth: {
    type: Boolean,
    default: false,
  },
  twilioPhoneNumber: {
    type: String,
    default: null,
  },
  twilioForwardNumber: {
    type: String,
    default: null,
  },
  twilioForwardNumberNew: {
    type: String,
    default: null,
  },
  twilioForwardNumberExisting: {
    type: String,
    default: null,
  },
  twilioMenuMessage: {
    type: String,
    default: null, // Custom menu message, falls back to default if not set
  },
  twilioVoice: {
    type: String,
    default: null, // Custom voice setting, falls back to 'Google.en-US-Chirp3-HD-Aoede' if not set
  },
  sharedFolderLink: {
    type: String,
    default: null,
  },
  sharedFolderName: {
    type: String,
    default: null,
  },
  bookingIntervalMonths: {
    type: Number, // Stores times per year: 1, 2, 3, 4, or 6 (maps to 12, 6, 4, 3, 2 month intervals)
    enum: [1, 2, 3, 4, 6], // 1=12/year (monthly), 2/year, 3/year, 4/year, 6/year
    default: 1 // Default to monthly (12 times per year)
  },
  gallery: [
    {
      name: String,
      url: String,
      date: Date,
    }
  ],
  invoices: [
    {
      name: String,
      url: String,
      date: Date,
    }
  ],
  visibleGalleryItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'GalleryItem' }],
  visibleInvoices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' }],
  // QuickBooks Integration
  quickbooksAccessToken: {
    type: String,
    default: null,
  },
  quickbooksRefreshToken: {
    type: String,
    default: null,
  },
  quickbooksRealmId: {
    type: String,
    default: null, // Company ID
  },
  quickbooksTokenExpiry: {
    type: Date,
    default: null,
  },
  quickbooksRefreshTokenExpiry: {
    type: Date,
    default: null,
  },
  quickbooksConnected: {
    type: Boolean,
    default: false,
  },
  quickbooksNeedsReauth: {
    type: Boolean,
    default: false,
  },
  quickbooksLastSynced: {
    type: Date,
    default: null,
  },
  quickbooksOAuthState: {
    type: String,
    default: null, // Temporary state for OAuth flow
  },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
