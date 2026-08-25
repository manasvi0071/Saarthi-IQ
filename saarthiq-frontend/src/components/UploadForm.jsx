// src/components/UploadForm.jsx
import React, { useState, useCallback } from 'react';
import { UploadCloud, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const UploadForm = ({ onUpload, compact = false }) => {
  // Block visibility for blocked departments: Recruitment, Franchise Development
  const getCurrentUserPayload = () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return null
      // Extract payload from JWT
      const payloadSegment = token.split('.')[1]
      if (!payloadSegment) return null
      const payload = JSON.parse(atob(payloadSegment))
      return payload
    } catch (e) {
      return null
    }
  }

  const payload = getCurrentUserPayload()
  const isBlockedDept = Boolean(payload) && !payload.is_admin && ['recruitment','franchise development','franchise'].includes((payload.department || '').toLowerCase())

  if (isBlockedDept) {
    // Show a friendly block message instead of rendering an empty space
    return (
      <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-lg text-yellow-800">
        Uploads are blocked for your department.
      </div>
    )
  }
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  const getLS = (keys) => {
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v !== 'undefined' && v !== 'null') return v;
    }
    return '';
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Validate file types and size
    const validFiles = selectedFiles.filter(file => {
      const validTypes = ['.xlsx', '.xls', '.csv'];
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!validTypes.includes(ext)) {
        setMessage(`File ${file.name} is not a valid type. Only Excel and CSV files are allowed.`);
        setMessageType('error');
        return false;
      }
      
      if (file.size > 50 * 1024 * 1024) { // 50MB
        setMessage(`File ${file.name} is too large. Maximum size is 50MB.`);
        setMessageType('error');
        return false;
      }
      
      return true;
    });
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles].slice(0, 5)); // Limit to 5 files
      setMessage('');
      setMessageType('');
    }
    
    e.target.value = ''; // Reset input
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage('Please select at least one file to upload.');
      setMessageType('error');
      return;
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    // Add user info
    const userId = getLS(['userId', 'id']);
    const userName = getLS(['userName', 'name']) || 'Unknown User';
    
    formData.append('userId', userId);
    formData.append('uploaderName', userName);

    setUploading(true);
    setProgress(0);
    setMessage('Uploading files...');
    setMessageType('');

    try {
     const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage(`Successfully uploaded ${files.length} file(s). ${data.stats.inserted} new profiles added.`);
        setMessageType('success');
        
        // Update progress
        setProgress(100);
        
        // Clear files after successful upload
        setTimeout(() => {
          setFiles([]);
          setProgress(0);
        }, 2000);
        
        // Notify parent component
        if (onUpload) {
          setTimeout(onUpload, 1000);
        }
      } else {
        setMessage(`Upload failed: ${data.error || 'Unknown error'}`);
        setMessageType('error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage(`Upload failed: ${error.message || 'Network error'}`);
      setMessageType('error');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const validFiles = droppedFiles.filter(file => {
      const validTypes = ['.xlsx', '.xls', '.csv'];
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      return validTypes.includes(ext) && file.size <= 50 * 1024 * 1024;
    });
    
    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles].slice(0, 5));
      setMessage('');
      setMessageType('');
    } else if (droppedFiles.length > 0) {
      setMessage('Invalid file(s). Only Excel and CSV files up to 50MB are allowed.');
      setMessageType('error');
    }
  }, []);

  if (compact) {
    return (
      <div className="w-full">
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-500 transition duration-150 cursor-pointer bg-gray-50"
          onClick={() => document.getElementById('file-input-compact').click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <UploadCloud className="mx-auto text-gray-400 mb-2" size={24} />
          <p className="text-sm text-gray-600 mb-1">
            Drag & drop files or click to select
          </p>
          <p className="text-xs text-gray-500">Max 5 files, 50MB each (.xlsx, .xls, .csv)</p>
          <input
            id="file-input-compact"
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {files.length > 0 && (
          <div className="mt-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Selected Files ({files.length})
              </span>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
            
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-xs">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-gray-500" />
                    <span className="truncate max-w-[150px]">{file.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{formatFileSize(file.size)}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {message && (
          <div className={`mt-3 p-2 rounded text-sm ${
            messageType === 'success' 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {messageType === 'success' ? (
                <CheckCircle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <span>{message}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Upload Excel/CSV Files</h2>
        
        {/* Drag & Drop Area */}
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition duration-150 ${
            uploading 
              ? 'border-purple-300 bg-purple-50' 
              : 'border-gray-300 hover:border-purple-500 hover:bg-gray-50'
          }`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !uploading && document.getElementById('file-input').click()}
        >
          <div className="mb-4">
            <UploadCloud className={`mx-auto ${uploading ? 'text-purple-500' : 'text-gray-400'}`} size={48} />
          </div>
          
          <p className="text-lg font-medium text-gray-700 mb-2">
            {uploading ? 'Uploading...' : 'Drag & drop files here'}
          </p>
          
          <p className="text-gray-600 mb-4">
            or click to browse files from your computer
          </p>
          
          <div className="mb-4">
            <button
              onClick={(e) => {
                e.stopPropagation();
                document.getElementById('file-input').click();
              }}
              disabled={uploading}
              className="px-6 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select Files
            </button>
          </div>
          
          <p className="text-sm text-gray-500">
            Supports: .xlsx, .xls, .csv | Max: 5 files, 50MB each
          </p>
          
          <input
            id="file-input"
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
        </div>

        {/* Progress Bar */}
        {uploading && (
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Upload Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Selected Files */}
        {files.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-700">
                Selected Files ({files.length}/5)
              </h3>
              <button
                onClick={() => setFiles([])}
                className="text-sm text-red-600 hover:text-red-800 hover:underline"
                disabled={uploading}
              >
                Clear All
              </button>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-800 truncate max-w-md">{file.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {file.type || 'Unknown type'}
                    </span>
                    <button
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                      className="text-gray-400 hover:text-red-500 transition duration-150 disabled:opacity-50"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Button */}
        {files.length > 0 && !uploading && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition duration-150 shadow-md flex items-center gap-2"
            >
              <UploadCloud size={20} />
              Upload {files.length} File{files.length > 1 ? 's' : ''}
            </button>
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div className={`mt-4 p-4 rounded-lg ${
            messageType === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-700' 
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <div className="flex items-start gap-3">
              {messageType === 'success' ? (
                <CheckCircle className="flex-shrink-0 mt-0.5" size={20} />
              ) : (
                <AlertCircle className="flex-shrink-0 mt-0.5" size={20} />
              )}
              <div>
                <p className="font-medium">
                  {messageType === 'success' ? 'Success!' : 'Error!'}
                </p>
                <p className="mt-1">{message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Instructions */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-medium text-gray-700 mb-2">File Requirements:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
              <span>Files should contain columns like: Name, Email, Phone, Current Location, Designation, etc.</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
              <span>Only profiles from major Indian cities will be imported (Mumbai, Delhi, Bangalore, etc.)</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
              <span>Duplicate profiles (by email) will be skipped automatically</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default UploadForm;
