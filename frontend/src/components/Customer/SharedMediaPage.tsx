import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaFolder, FaExternalLinkAlt, FaSpinner, FaExclamationTriangle, FaCloud, FaShare, FaStickyNote, FaCheck, FaTimes } from 'react-icons/fa';

interface SharedFolderInfo {
  folderLink: string;
  folderName: string;
  customerName: string;
  hasFolder: boolean;
}

interface ClientNote {
  _id: string;
  note: string;
  createdAt: string;
  expiresAt: string;
}

const SharedMediaPage: React.FC = () => {
  const [folderInfo, setFolderInfo] = useState<SharedFolderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState(false);

  useEffect(() => {
    fetchFolderInfo();
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/client-notes/my-notes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotes(response.data);
    } catch (err: any) {
      console.error('Failed to fetch notes', err);
    }
  };

  const submitNote = async () => {
    if (!newNote.trim()) {
      setError('Please enter a note');
      return;
    }

    if (newNote.length > 1000) {
      setError('Note must be 1000 characters or less');
      return;
    }

    setSubmittingNote(true);
    setError(null);

    try {
      const token = localStorage.getItem('customerToken');
      await axios.post(`${import.meta.env.VITE_API_BASE_URL}/client-notes/create`, {
        note: newNote.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setNoteSuccess('Note submitted successfully! Our team will be notified.');
      setNewNote('');
      setShowNoteForm(false);
      fetchNotes();
      
      setTimeout(() => setNoteSuccess(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit note');
    } finally {
      setSubmittingNote(false);
    }
  };

  const fetchFolderInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('customerToken');
      const response = await axios.get(`${import.meta.env.VITE_API_BASE_URL}/shared-folders/my-folder`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setFolderInfo(response.data);
    } catch (err: any) {
      console.error('Failed to fetch shared folder info', err);
      setError(err.response?.data?.error || 'Failed to fetch shared folder information');
    } finally {
      setLoading(false);
    }
  };

  const openSharedFolder = () => {
    if (folderInfo?.folderLink) {
      // Ensure the link is a complete URL
      let url = folderInfo.folderLink;
      
      // If it doesn't start with http:// or https://, add https://
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <FaSpinner className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading shared folder information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <FaExclamationTriangle className="text-4xl text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Folder</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchFolderInfo}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!folderInfo?.hasFolder) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <FaFolder className="text-6xl text-gray-400 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Shared Folder Assigned</h3>
          <p className="text-gray-600 mb-6">
            Your shared folder hasn't been set up yet. Please contact your administrator to assign a shared folder for media sharing.
          </p>
          <button
            onClick={fetchFolderInfo}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 overflow-x-hidden w-full max-w-6xl xl:max-w-7xl 2xl:max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center mb-2">
          <FaShare className="mr-3 text-blue-600" />
          Share Your Media
        </h1>
        <p className="text-gray-600">
          Access your shared folder to upload and share media files with our team
        </p>
      </div>

      {/* Success Message */}
      {noteSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <FaCheck className="text-green-600 mr-2" />
            <p className="text-green-800">{noteSuccess}</p>
          </div>
        </div>
      )}

      {/* Folder Information Card */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg mr-4">
              <FaCloud className="text-2xl text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{folderInfo.folderName}</h3>
              <p className="text-gray-600">Your dedicated shared folder</p>
            </div>
          </div>
          <button
            onClick={openSharedFolder}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FaExternalLinkAlt className="mr-2" />
            Open Folder
          </button>
        </div>
      </div>

      {/* Client Notes Section */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FaStickyNote className="mr-2 text-blue-600" />
            Leave a Note for Our Team
          </h3>
          <button
            onClick={() => setShowNoteForm(!showNoteForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showNoteForm ? 'Cancel' : 'Add Note'}
          </button>
        </div>

        {showNoteForm && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tell us about your uploads (optional)
            </label>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Describe what you uploaded, how we can use it, or any specific instructions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white resize-none"
              rows={4}
              maxLength={1000}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-500">
                {newNote.length}/1000 characters
              </span>
              <button
                onClick={submitNote}
                disabled={submittingNote || !newNote.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingNote ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Note'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Recent Notes */}
        {notes.length > 0 && (
          <div>
            <h4 className="text-md font-semibold text-gray-700 mb-3">Your Recent Notes</h4>
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note._id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-800 mb-2">{note.note}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Submitted: {new Date(note.createdAt).toLocaleDateString()}</span>
                    <span>Expires: {new Date(note.expiresAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Share Your Media</h3>
        <div className="space-y-3 text-blue-800">
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">1</span>
            <p><strong>Click "Open Folder"</strong> to access your shared folder in Google Drive or Synology</p>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">2</span>
            <p><strong>Upload your media files</strong> (photos, videos, documents) directly to the folder</p>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">3</span>
            <p><strong>Organize your files</strong> by creating subfolders or using descriptive filenames</p>
          </div>
          <div className="flex items-start">
            <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold mr-3 mt-0.5">4</span>
            <p><strong>Our team will have access</strong> to view and download your shared media files</p>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Tips for Better Organization</h3>
        <div className="space-y-2 text-gray-700">
          <p>• <strong>Use descriptive filenames:</strong> Include dates, event names, or content descriptions</p>
          <p>• <strong>Create subfolders:</strong> Organize by event, date, or media type (photos, videos, documents)</p>
          <p>• <strong>Check file formats:</strong> Ensure your files are in commonly supported formats</p>
          <p>• <strong>Keep files updated:</strong> Remove old or outdated files to keep the folder organized</p>
        </div>
      </div>
    </div>
  );
};

export default SharedMediaPage;
