const mongoose = require('mongoose');

/**
 * Maps an IMAP folder name to a customer (clinic).
 * When leads land in a folder (e.g. "Burlington Dental Centre"), all emails in that folder
 * are assigned to the mapped customer. Folder name is matched case-insensitively and
 * against the folder path's last segment (e.g. "INBOX.Burlington Dental Centre" -> "Burlington Dental Centre").
 */
const metaLeadFolderMappingSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  /** Display folder name as shown in cPanel (e.g. "Burlington Dental Centre") */
  folderName: {
    type: String,
    required: true,
    trim: true
  },
  /** Lowercase for case-insensitive matching */
  folderNameLower: {
    type: String,
    required: true,
    index: true,
    lowercase: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MetaLeadFolderMapping', metaLeadFolderMappingSchema);
