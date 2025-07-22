import { useSelector } from 'react-redux';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const RequestFormSidebar = dynamic(() => import('./sidebar'));
const Avatar = dynamic(() => import('../avatar'));
const NotificationBell = dynamic(() => import('../notification-bell'));
const Spinner = dynamic(() => import('../ui/spinner'));

export default function BookingFormLayout({ 
    setBookingSubmittedState, 
    children
}) {
    const loading = useSelector(state => state.global.loading);
    const user = useSelector(state => state.user.user);

    return (
        <div className="relative h-screen flex flex-col">
            {/* Mobile Header */}
            <div className='flex h-20 w-full items-center lg:hidden z-50 bg-white shadow-sm'>
                <div className="w-full flex items-center justify-between px-4">
                    <Link href="/">
                        <a>
                            <img 
                                src="/sargood-logo.svg" 
                                alt="Sargood On Collaroy" 
                                className="h-14 w-auto max-w-full"
                                style={{ maxHeight: '75px' }}
                            />
                        </a>
                    </Link>
                    
                    <div className="flex items-center">
                        <div className="flex items-center">
                            <NotificationBell />
                            {user && <Avatar />}
                        </div>
                    </div>
                </div>
            </div>

            {/* Desktop Header - Logo and User controls only */}
            <div className="hidden lg:flex items-center h-20 w-full justify-between px-6 shadow-sm bg-white z-10">
                <Link href="/">
                    <a className="flex items-center">
                        <img 
                            src="/sargood-logo.svg" 
                            alt="Sargood On Collaroy" 
                            className="h-16 w-auto"
                            style={{ maxHeight: '75px' }}
                        />
                    </a>
                </Link>
                
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <NotificationBell />
                        {user && <Avatar />}
                    </div>
                </div>
            </div>

            {/* Main Layout - Below Header - FIXED: Single scrollable container */}
            <div className="flex-1 overflow-auto">
                <div className="flex min-h-full">
                    {/* Sidebar */}
                    <div className="hidden md:block w-96 lg:w-80 xl:w-72 flex-shrink-0">
                        <RequestFormSidebar setBookingSubmittedState={setBookingSubmittedState} />
                    </div>
                    
                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col">
                        {/* Main Content */}
                        <main className='w-full flex-1'>
                            {children}
                        </main>
                        
                        {loading && <Spinner small={true} />}
                    </div>
                </div>
            </div>
        </div>
    )
}