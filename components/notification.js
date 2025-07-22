import moment from "moment";
import { useRouter } from "next/router";
import Image from "next/image";

const Notification = ({ data, handleRead }) => {
    const router = useRouter();

    const handleOpenLink = () => {
        router.push(data.link);
    }

    const handleNotificationClick = () => {
        handleRead(data);
        if (data.link) {
            handleOpenLink();
        }
    }

    return (
        <div 
            className={`flex items-start gap-3 p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200 ${
                data.link ? 'cursor-pointer' : ''
            } ${
                !data.read ? 'bg-[#E3EEF6]' : 'bg-white'
            }`}
            onClick={handleNotificationClick}
        >
            {/* Avatar/Icon placeholder */}
            <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-yellow-400 rounded-sm flex items-center justify-center">
                    <div className="text-blue-600 text-xs font-bold">🏢</div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">
                            {data.title || getNotificationTitle(data.message)}
                        </h4>
                        <p className="text-sm text-gray-600 leading-relaxed">
                            {data.message}
                        </p>
                        {data.booking_id && (
                            <p className="text-xs text-gray-500 mt-1">
                                Booking ID: <span className="font-medium">{data.booking_id}</span>
                            </p>
                        )}
                    </div>
                    
                    {/* Time and external link icon */}
                    <div className="flex items-center gap-2 ml-3">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                            {moment(data.createdAt).fromNow()}
                        </span>
                        {data.link && (
                            <svg 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                xmlns="http://www.w3.org/2000/svg" 
                                className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenLink();
                                }}
                            >
                                <path 
                                    d="M10.0002 5H8.2002C7.08009 5 6.51962 5 6.0918 5.21799C5.71547 5.40973 5.40973 5.71547 5.21799 6.0918C5 6.51962 5 7.08009 5 8.2002V15.8002C5 16.9203 5 17.4801 5.21799 17.9079C5.40973 18.2842 5.71547 18.5905 6.0918 18.7822C6.5192 19 7.07899 19 8.19691 19H15.8031C16.921 19 17.48 19 17.9074 18.7822C18.2837 18.5905 18.5905 18.2839 18.7822 17.9076C19 17.4802 19 16.921 19 15.8031V14M20 9V4M20 4H15M20 4L13 11" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                    </div>
                </div>
                
                {/* Created by info */}
                {data.createdBy && (
                    <p className="text-xs text-gray-500 mt-2">
                        by {data.createdBy}
                    </p>
                )}
            </div>

            {/* Unread indicator dot */}
            {!data.read && (
                <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            )}
        </div>
    );
}

// Helper function to extract title from message
const getNotificationTitle = (message) => {
    if (message.toLowerCase().includes('booking') && message.toLowerCase().includes('confirmed')) {
        return 'Booking Confirmed!';
    }
    if (message.toLowerCase().includes('congratulations')) {
        return 'Congratulations!';
    }
    if (message.toLowerCase().includes('cancelled')) {
        return 'Booking Cancelled!';
    }
    // Default title extraction - take first few words
    return message.split(' ').slice(0, 3).join(' ') + (message.split(' ').length > 3 ? '...' : '');
}

export default Notification;