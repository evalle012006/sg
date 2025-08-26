import { useEffect, useRef, useState } from "react";
import { toast } from 'react-toastify';
import { checkFileSize } from "../utilities/common";

export default function MultipleUploadFile(props) {
  const [files, setFiles] = useState([]);
  const [bucketType, setBucketType] = useState(props.bucketType || 'restricted');
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleUpload = async () => {
    if (files.length === 0) return;

    // Check size for all files
    for (const file of files) {
      const fileSizeMsg = checkFileSize(file.size, 5120000);
      if (fileSizeMsg) {
        toast.error(`${file.name}: ${fileSizeMsg}`, 10240);
        return;
      }
    }

    setUploading(true);
    const uploadPromises = files.map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileType", props.fileType);
      formData.append("metadata", JSON.stringify(props.metadata));

      try {
        const response = await fetch("/api/storage/upload", {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        return { 
          filename: file.name,
          success: response.ok,
          message: data.message,
          fileUrl: data.fileUrl
        };
      } catch (error) {
        return {
          filename: file.name,
          success: false,
          message: "Upload failed"
        };
      }
    });

    const results = await Promise.all(uploadPromises);
    
    // Show results
    results.forEach(result => {
      if (result.success) {
        toast.success(`${result.filename}: ${result.message}`);
      } else {
        toast.error(`${result.filename}: ${result.message}`);
      }
    });

    setFiles([]);
    fileInputRef.current.value = null;
    setUploading(false);
    
    // Call onUpload with array of successful uploads
    const successfulUploads = results.filter(r => r.success).map(r => r.fileUrl);
    if (successfulUploads.length > 0) {
      props.onUpload(successfulUploads);
    }
  };

  useEffect(() => {
    if (files.length > 0) {
      handleUpload();
    }
  }, [files]);

  const handleFileSelect = (newFiles) => {
    setFiles(Array.from(newFiles));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <div 
      className={`
        flex flex-col justify-center items-center w-full rounded-lg p-12 text-center 
        border-2 border-dashed cursor-pointer transition-all duration-200
        ${isDragOver 
          ? 'border-blue-400 bg-blue-50' 
          : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !uploading && fileInputRef.current.click()}
    >
      {uploading ? (
        <div className="flex flex-col items-center">
          <div className="mb-4">
            <svg className="animate-spin h-12 w-12 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600 font-medium">
            Uploading {files.length} file{files.length > 1 ? 's' : ''}...
          </p>
        </div>
      ) : (
        <>
          {/* Upload Icon */}
          <div className="mb-4">
            <svg 
              className="w-16 h-16 text-gray-400 mx-auto" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 48 48"
              strokeWidth={1}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
              />
            </svg>
          </div>
          
          {/* Upload Text */}
          <div className="space-y-1">
            <p className="text-gray-600 text-base">
              Drag and drop or click here to
            </p>
            <p className="text-blue-600 font-medium text-base">
              browse file
            </p>
          </div>

          {/* File size info */}
          <p className="text-xs text-gray-400 mt-3">
            Maximum file size: 5MB
          </p>
        </>
      )}
      
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        disabled={uploading}
      />
    </div>
  );
}