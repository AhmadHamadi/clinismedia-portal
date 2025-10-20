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
  bookingIntervalMonths: {
    type: Number, // 1 for monthly, 3 for quarterly
    enum: [1, 3],
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
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);