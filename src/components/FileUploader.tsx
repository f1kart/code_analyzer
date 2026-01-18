import React, { useRef } from 'react';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      onFilesSelected(Array.from(event.target.files));
    }
    // Reset the input value to allow uploading the same file/folder again
    event.target.value = '';
  };

  return (
    <div>
      <div className="flex space-x-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
          aria-hidden="true"
        />
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFileChange}
          {...({
            webkitdirectory: 'true',
            directory: 'true',
          } as any)}
          multiple
          className="hidden"
          aria-hidden="true"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-brand-blue"
          aria-label="Upload one or more files"
        >
          Upload File(s)
        </button>
        <button
          onClick={() => folderInputRef.current?.click()}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-brand-blue"
          aria-label="Upload a folder"
        >
          Upload Folder
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1.5 ml-1">
        Load code from your local machine to get started.
      </p>
    </div>
  );
};
