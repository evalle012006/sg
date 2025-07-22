import { FileDown, Mail, Loader2 } from 'lucide-react';
import { useState } from 'react';

const BookingActionIcons = ({ handleDownloadPDF, handleEmailPDF }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await handleDownloadPDF();
    } finally {
      setIsDownloading(false);
    }
  };

  const handleEmail = async () => {
    setIsSending(true);
    try {
      await handleEmailPDF();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex items-center space-x-2 md:space-x-4 ml-auto">
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed"
        title="Download Summary of Stay"
      >
        {isDownloading ? (
          <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-gray-600 animate-spin" />
        ) : (
          <FileDown className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
        )}
      </button>

      <button
        onClick={handleEmail}
        disabled={isSending}
        className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 disabled:bg-gray-50 disabled:cursor-not-allowed"
        title="Send via Email"
      >
        {isSending ? (
          <Loader2 className="w-5 h-5 md:w-6 md:h-6 text-gray-600 animate-spin" />
        ) : (
          <Mail className="w-5 h-5 md:w-6 md:h-6 text-gray-600" />
        )}
      </button>
    </div>
  );
};

export default BookingActionIcons;