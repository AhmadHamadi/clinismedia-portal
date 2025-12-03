# Gallery/Media Viewing System - Complete Review

## 📋 Overview
The gallery system allows admins to upload/manage media items and assign them to customers (clinics). Customers can view their assigned media items in their portal.

---

## 🗂️ File Structure

### Frontend Components
1. **`frontend/src/components/Customer/CustomerGalleryPage.tsx`** - Customer view
2. **`frontend/src/components/Admin/AdminGalleryPage.tsx`** - Admin management

### Backend Files
1. **`backend/routes/gallery.js`** - All API endpoints
2. **`backend/models/GalleryItem.js`** - Gallery item model
3. **`backend/models/AssignedGalleryItem.js`** - Assignment model
4. **`backend/server.js`** - Static file serving setup

---

## 🎯 Customer Gallery Page (`CustomerGalleryPage.tsx`)

### Features
- ✅ View current media item (marked as `isCurrent: true`)
- ✅ View media history (all previous assignments)
- ✅ Support for both uploaded images and external URLs
- ✅ Responsive layout (2/3 current, 1/3 history)

### Data Flow
1. Fetches assigned items: `GET /api/gallery/assigned/:clinicId`
2. Separates current vs history items based on `isCurrent` flag
3. Displays current item prominently on left
4. Shows history items in sidebar on right

### Image Display Logic
```typescript
// For uploaded images (starts with /uploads/)
if (item.galleryItemId.url.startsWith('/uploads/')) {
  // Construct full URL from backend
  src={`${VITE_BACKEND_BASE_URL || VITE_API_BASE_URL?.replace('/api', '')}${item.galleryItemId.url}`}
} else {
  // External URL - show as link
  <a href={item.galleryItemId.url}>View Media</a>
}
```

### Current State
- ✅ Fetches data on component mount
- ✅ Handles loading state
- ✅ Shows empty state when no media
- ✅ Displays assignment date
- ⚠️ No error handling UI (only console.error)
- ⚠️ No refresh/retry mechanism

---

## 🔧 Admin Gallery Page (`AdminGalleryPage.tsx`)

### Features
1. **Gallery Item Management**
   - ✅ Create new items (URL or file upload)
   - ✅ Edit existing items
   - ✅ Delete items
   - ✅ View all items in table

2. **Assignment Management**
   - ✅ Assign items to clinics
   - ✅ Update assignment status (Current/History)
   - ✅ Remove assignments
   - ✅ View all assignments per item

3. **Filtering**
   - ✅ Filter by clinic
   - ✅ Filter by month (last 12 months)

4. **Email Notifications**
   - ✅ Send custom emails to clinics
   - ✅ Template with `{clinicName}` variable

### Data Flow
1. Fetches gallery items: `GET /api/gallery`
2. Fetches clinics: `GET /api/customers`
3. Fetches assignments: `GET /api/gallery/assignments/all`
4. Filters items based on selected clinic/month

### Image Upload Flow
```typescript
// File upload
1. User selects file
2. FormData created with file + name
3. POST /api/gallery/upload
4. If clinic selected, auto-assigns to clinic
5. Refreshes gallery items list
```

### Current State
- ✅ Full CRUD operations
- ✅ Bulk assignment (checkbox selection)
- ✅ Assignment status management
- ✅ Email notification system
- ⚠️ No pagination (could be slow with many items)
- ⚠️ No image preview in table
- ⚠️ No drag-and-drop upload
- ⚠️ No bulk delete

---

## 🔌 Backend Routes (`backend/routes/gallery.js`)

### Endpoints

#### 1. `GET /api/gallery` (Admin only)
- Returns all gallery items sorted by date (newest first)
- Used by admin to view all items

#### 2. `POST /api/gallery/upload` (Admin only)
- **File upload endpoint**
- Uses `multer` for file handling
- Saves to `/uploads/gallery/` directory
- Creates `GalleryItem` with URL: `/uploads/gallery/{filename}`
- **File validation:**
  - Max size: 10MB
  - Allowed types: jpeg, jpg, png, gif, webp
- **Error handling:** Deletes uploaded file if validation fails

#### 3. `POST /api/gallery` (Admin only)
- **URL-based gallery item creation**
- Requires `name` and `url`
- Used for external URLs (Google Drive, Dropbox, etc.)

#### 4. `PUT /api/gallery/:id` (Admin only)
- Updates gallery item (name, url, date)
- Used by admin edit modal

#### 5. `DELETE /api/gallery/:id` (Admin only)
- Deletes gallery item
- **Also deletes all assignments** for that item
- ⚠️ Does NOT delete uploaded file from disk

#### 6. `POST /api/gallery/assign` (Admin only)
- Assigns gallery items to a clinic
- **Logic:**
  1. Sets all existing assignments for clinic to `isCurrent: false`
  2. Creates new assignments with `isCurrent: true`
  3. Increments customer notification count
  4. Sends email notification to customer
- **Email notification:**
  - Uses `EmailService.sendNewContentNotification()`
  - Links to: `https://clinimediaportal.ca/customer/gallery`

#### 7. `GET /api/gallery/assigned/:clinicId` (Admin/Customer)
- Returns all assigned items for a clinic
- Populates `galleryItemId` (full gallery item data)
- Sorted by `assignedAt` (newest first)
- Used by customer portal

#### 8. `GET /api/gallery/assignments/all` (Admin only)
- Returns all clinics and all assignments
- Used by admin for overview/management
- Populates both `galleryItemId` and `clinicId`

#### 9. `POST /api/gallery/update-assignment` (Admin only)
- Updates assignment status (Current/History)
- If setting to `isCurrent: true`, sets all other clinic assignments to `false`
- Ensures only one current item per clinic

#### 10. `POST /api/gallery/remove-assignment` (Admin only)
- Removes assignment (doesn't delete gallery item)
- Used when admin wants to unassign an item from a clinic

---

## 📊 Database Models

### GalleryItem Model
```javascript
{
  name: String (required),
  url: String (required), // Can be external URL or /uploads/gallery/filename
  date: Date (default: Date.now)
}
```

### AssignedGalleryItem Model
```javascript
{
  clinicId: ObjectId (ref: 'User', required),
  galleryItemId: ObjectId (ref: 'GalleryItem', required),
  isCurrent: Boolean (default: false),
  assignedAt: Date (default: Date.now),
  timestamps: true (createdAt, updatedAt)
}
```

### Relationships
- One `GalleryItem` can be assigned to multiple clinics
- One clinic can have multiple `AssignedGalleryItem` records
- Only one `AssignedGalleryItem` per clinic can have `isCurrent: true`

---

## 🖼️ Image Upload & Storage

### Upload Configuration
- **Directory:** `backend/uploads/gallery/`
- **Storage:** `multer.diskStorage`
- **Filename:** `{timestamp}-{random}-{originalname}`
- **Max Size:** 10MB
- **Allowed Types:** jpeg, jpg, png, gif, webp

### Static File Serving
```javascript
// backend/server.js
app.use('/uploads/gallery', express.static(__dirname + '/uploads/gallery'));
```

### URL Construction
- **Uploaded images:** `/uploads/gallery/{filename}`
- **Frontend display:** 
  - Production: `VITE_BACKEND_BASE_URL` or `VITE_API_BASE_URL.replace('/api', '')`
  - Development: `http://localhost:5000`

### Current Issues
- ⚠️ **No file cleanup:** Deleted gallery items don't remove files from disk
- ⚠️ **No file size validation on frontend** (only backend)
- ⚠️ **No image preview** before upload
- ⚠️ **No image optimization** (resize, compress)

---

## 🔄 Assignment Logic

### Current Assignment Flow
1. Admin selects items (checkboxes)
2. Admin selects clinic
3. Clicks "Assign"
4. Backend:
   - Sets all existing clinic assignments to `isCurrent: false`
   - Creates new assignments with `isCurrent: true`
   - Sends notification email
   - Increments notification count

### Status Management
- **`isCurrent: true`** - Shows in customer's "Latest Media" section
- **`isCurrent: false`** - Shows in customer's "Media History" section
- Only one item can be `isCurrent: true` per clinic at a time

### Assignment Rules
- ✅ Multiple items can be assigned to same clinic
- ✅ One item can be assigned to multiple clinics
- ✅ Admin can change status (Current ↔ History)
- ✅ Admin can remove assignments
- ⚠️ No bulk status update (must do one at a time)

---

## 📧 Email Notifications

### Automatic Notifications
- Triggered when items are assigned via `POST /api/gallery/assign`
- Uses `EmailService.sendNewContentNotification()`
- Template: "New Gallery Items"
- Link: `https://clinimediaportal.ca/customer/gallery`

### Manual Notifications
- Admin can send custom emails via modal
- Template variables: `{clinicName}`
- Subject and body are customizable
- Endpoint: `POST /api/email-notification-settings/send-custom`

---

## 🔔 Notification System Integration

### Customer Notifications
- Increments `CustomerNotification.gallery.unreadCount` on assignment
- Updates `CustomerNotification.gallery.lastUpdated`
- Used for notification badges in customer portal

---

## ⚠️ Current Issues & Limitations

### 1. File Management
- ❌ No cleanup of uploaded files when gallery item is deleted
- ❌ No file size validation on frontend
- ❌ No image optimization/resizing

### 2. User Experience
- ❌ No image preview in admin table
- ❌ No drag-and-drop upload
- ❌ No pagination (could be slow with many items)
- ❌ No search functionality
- ❌ No bulk operations (delete, status update)

### 3. Error Handling
- ⚠️ Customer page: Only console.error, no user-facing errors
- ⚠️ Admin page: Basic alerts, no detailed error messages
- ⚠️ No retry mechanism for failed requests

### 4. Performance
- ⚠️ No pagination for gallery items
- ⚠️ No lazy loading for images
- ⚠️ Fetches all assignments on admin page load

### 5. Security
- ✅ File type validation (backend)
- ✅ File size limit (10MB)
- ✅ Authentication required
- ⚠️ No virus scanning
- ⚠️ No rate limiting on uploads

---

## ✅ What Works Well

1. **Dual Upload Support:** Both file upload and URL input
2. **Assignment System:** Clear current/history separation
3. **Email Integration:** Automatic and manual notifications
4. **Filtering:** Clinic and month filters work well
5. **Responsive Design:** Customer page is mobile-friendly
6. **Notification Integration:** Properly increments unread counts

---

## 🎯 Potential Improvements

### High Priority
1. **File Cleanup:** Delete files when gallery items are deleted
2. **Image Preview:** Show thumbnails in admin table
3. **Error Handling:** Better user-facing error messages
4. **Pagination:** Add pagination for large lists

### Medium Priority
5. **Bulk Operations:** Bulk delete, bulk status update
6. **Search:** Search by name, date, clinic
7. **Image Optimization:** Resize/compress on upload
8. **Drag & Drop:** Better upload UX

### Low Priority
9. **Image Gallery View:** Grid view option
10. **Download:** Allow customers to download images
11. **Sharing:** Share links for specific items
12. **Analytics:** Track views/downloads

---

## 🔍 Key Code Sections

### Customer Fetch Logic
```typescript
// CustomerGalleryPage.tsx lines 30-65
useEffect(() => {
  fetchAssignedItems();
}, []);

const fetchAssignedItems = async () => {
  const clinicId = user.id || user._id;
  const res = await axios.get(`/api/gallery/assigned/${clinicId}`);
  const current = res.data.find(item => item.isCurrent);
  const history = res.data.filter(item => !item.isCurrent);
}
```

### Admin Assignment Logic
```typescript
// AdminGalleryPage.tsx lines 182-195
const handleAssignItems = async () => {
  await axios.post('/api/gallery/assign', {
    clinicId: selectedClinic,
    galleryItemIds: selectedItems,
  });
}
```

### Backend Assignment Endpoint
```javascript
// gallery.js lines 132-198
router.post('/assign', async (req, res) => {
  // 1. Set all existing to not current
  await AssignedGalleryItem.updateMany({ clinicId }, { isCurrent: false });
  
  // 2. Create new assignments
  await AssignedGalleryItem.insertMany(assignments);
  
  // 3. Send notification
  await EmailService.sendNewContentNotification(...);
});
```

---

## 📝 Summary

The gallery system is **functional and well-structured** with:
- ✅ Complete CRUD operations
- ✅ File upload support
- ✅ Assignment management
- ✅ Email notifications
- ✅ Customer viewing interface

**Main areas for improvement:**
- File cleanup on delete
- Better UX (previews, pagination, search)
- Error handling
- Performance optimizations

Ready for edits! What would you like to change or improve?




