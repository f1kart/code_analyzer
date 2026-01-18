import React, { useState } from 'react';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';

interface CopyButtonProps {
  textToCopy: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ textToCopy }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center text-sm font-medium text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-md bg-gray-700/50 hover:bg-gray-700"
      aria-label="Copy to clipboard"
    >
      {isCopied ? (
        <>
          <CheckIcon className="w-4 h-4 mr-1.5 text-green-400" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <ClipboardIcon className="w-4 h-4 mr-1.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
};
