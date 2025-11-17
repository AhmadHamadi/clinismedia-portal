const mongoose = require("mongoose");

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
    enum: ["admin", "customer", "employee"],
    default: "customer",
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
  facebookPageId: {
    type: String,
    default: null,
  },
  facebookPageName: {
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
  googleBusinessProfileId: {
    type: String,
    default: null,
  },
  googleBusinessProfileName: {
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
  sharedFolderLink: {
    type: String,
    default: null,
  },
  sharedFolderName: {
    type: String,
    default: null,
  },
  bookingIntervalMonths: {
    type: Number, // 1 for monthly, 2 for bi-monthly, 3 for quarterly, 4 for 4x/year, 6 for 6x/year
    enum: [1, 2, 3, 4, 6],
    default: 1
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