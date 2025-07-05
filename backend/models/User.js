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
  department: {
    type: String,
    enum: ["photography", "web", "social"],
    required: function () {
      return this.role === "employee";
    },
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