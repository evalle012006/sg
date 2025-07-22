import React, { useState } from 'react';
import { toast } from 'react-toastify';

const DocumentRenameModal = ({ isOpen, onClose, onRename, currentName }) => {
  const getNameAndExtension = (filename) => {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) return [filename, ''];
    return [
      filename.substring(0, lastDotIndex),
      filename.substring(lastDotIndex)
    ];
  };

  const [nameWithoutExt, extension] = getNameAndExtension(currentName);
  const [newName, setNewName] = useState(nameWithoutExt);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('File name cannot be empty');
      return;
    }
    
    onRename(newName.trim() + extension);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h3 className="text-lg font-semibold mb-4">Rename Document</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center space-x-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <span className="text-gray-500 text-sm">{extension}</span>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentRenameModal;