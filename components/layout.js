import dynamic from 'next/dynamic';
import Sidebar from './sidebar'
import ReactTooltip from 'react-tooltip';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';

import { globalActions } from '../store/globalSlice';
import React, { useState } from 'react';

const Avatar = dynamic(() => import('./avatar'));
const NotificationBell = dynamic(() => import('./notification-bell'));
const Spinner = dynamic(() => import('./ui/spinner'));

export default function Layout({ 
  children, 
  noScroll = false, 
  title, 
  hideTitleBar = false, 
  hideSpinner = false,
  hideSidebar = false,
  useFlexLayout = false,
  singleScroll = false  // New prop for single scroll behavior
}) {
    const loading = useSelector(state => state.global.loading);
    const menuOpen = useSelector(state => state.global.menuOpen);
    const user = useSelector(state => state.user.user);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const dispatch = useDispatch();

    const toggleMenu = () => {
        dispatch(globalActions.toggleMenu());
    }

    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    }

    const MenuIcon = () => (
        <svg width="24" height="18" viewBox="0 0 24 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.875 9H22" stroke="#00467F" strokeWidth="2.5" strokeMiterlimit="10" strokeLinecap="round"/>
            <path d="M1.875 16H12.018" stroke="#00467F" strokeWidth="2.5" strokeMiterlimit="10" strokeLinecap="round"/>
            <path d="M1.875 2H17.2034" stroke="#00467F" strokeWidth="2.5" strokeMiterlimit="10" strokeLinecap="round"/>
        </svg>
    );

    return (
        <div className='relative'>
            {/* Mobile Header - Single unified header */}
            <div className='fixed flex h-20 w-full items-center lg:hidden z-50 bg-white shadow-sm my-1'>
                {!hideSidebar ? (
                    // When sidebar is visible - show hamburger + avatar/notifications
                    <>
                        <button 
                            onClick={toggleMenu}
                            className="p-2 mx-2 hover:bg-gray-100 rounded transition-colors"
                            title="Show/Hide menu"
                        >
                            <MenuIcon />
                        </button>
                        <div className="flex-1 flex items-center justify-end px-4">
                            <div className="flex items-center">
                                {!hideTitleBar && title && (
                                    <h2 className="mr-2 text-lg font-medium truncate max-w-[150px]">{title}</h2>
                                )}
                                <NotificationBell />
                                {user && <Avatar />}
                            </div>
                        </div>
                    </>
                ) : (
                    // When sidebar is hidden - show logo + title + avatar/notifications
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
                            {!hideTitleBar && title && (
                                <h2 className="mr-2 text-lg font-medium truncate max-w-[150px]">{title}</h2>
                            )}
                            <div className="flex items-center">
                                <NotificationBell />
                                {user && <Avatar />}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className='h-20 lg:hidden'></div>
            
            {/* Main container - different structure for single scroll */}
            {singleScroll ? (
                // Single scroll layout - everything scrolls together
                <div className="min-h-screen overflow-y-auto">
                    <div className='flex w-full'>
                        {/* Sidebar - hide based on prop or mobile state */}
                        {!hideSidebar && (
                            <div className={`
                                ${menuOpen ? 'fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto' : 'hidden'} 
                                lg:block lg:w-auto lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto
                            `}>
                                <Sidebar isCollapsed={isCollapsed} />
                            </div>
                        )}
                        
                        {/* Main content */}
                        <div className="w-full flex-1">
                            {/* Desktop header with logo when sidebar is hidden */}
                            {hideSidebar && (
                                <div className="hidden lg:flex items-center h-20 w-full justify-between px-6 shadow-sm sticky top-0 bg-white z-10">
                                    <Link href="/">
                                        <a className="flex items-center">
                                            <img 
                                                src="/sargood-logo.svg" 
                                                alt="Sargood On Collaroy" 
                                                className="h-20 w-auto"
                                                style={{ maxHeight: '85px' }}
                                            />
                                        </a>
                                    </Link>
                                    
                                    {/* Title, notification and avatar in same row */}
                                    <div className="flex items-center space-x-4">
                                        {!hideTitleBar && (
                                            <h1 className="page-title mr-6">{title}</h1>
                                        )}
                                        <div className="flex items-center">
                                            <NotificationBell />
                                            {user && <Avatar />}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Desktop Title bar - when sidebar is visible, always show avatar and notification */}
                            {!hideSidebar && (
                                <div className="hidden lg:flex flex-col md:flex-row justify-between mt-4 mr-6 sticky top-0 bg-white z-10 pb-4">
                                    <div className="flex items-center w-full justify-between">
                                        <div className="flex items-center ml-4"> {/* Added ml-4 here for spacing */}
                                            {/* Desktop menu toggle - only for collapse/expand */}
                                            <button 
                                                onClick={toggleCollapse}
                                                className={`p-2 mr-4 rounded transition-colors ${!isCollapsed ? 'bg-[#E3EEF6] hover:bg-[#D4E0E9]' : 'hover:bg-gray-100'}`}
                                                title="Collapse menu"
                                            >
                                                <MenuIcon />
                                            </button>
                                        </div>
                                        {/* Always show NotificationBell and Avatar when sidebar is visible */}
                                        <div className='flex items-center'>
                                            {!hideTitleBar && title && (
                                                <h1 className="page-title mr-6">{title}</h1>
                                            )}
                                            <NotificationBell />
                                            {user && <Avatar />}
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Main content - no height restrictions, natural flow */}
                            <main className="w-full">
                                {children}
                            </main>
                        </div>
                    </div>
                </div>
            ) : (
                // Original layout structure
                <div className='flex h-screen w-full overflow-hidden'>
                    {/* Sidebar - hide based on prop or mobile state */}
                    {!hideSidebar && (
                        <div className={`
                            ${menuOpen ? 'fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-auto' : 'hidden'} 
                            lg:block lg:w-auto
                        `}>
                            <Sidebar isCollapsed={isCollapsed} />
                        </div>
                    )}
                    
                    {/* Main content - adjust width based on sidebar visibility */}
                    <div className="w-full flex-1 flex flex-col overflow-hidden">
                        {/* Desktop header with logo when sidebar is hidden */}
                        {hideSidebar && (
                            <div className="hidden lg:flex items-center h-20 w-full justify-between px-6 shadow-sm">
                                <Link href="/">
                                    <a className="flex items-center">
                                        <img 
                                            src="/sargood-logo.svg" 
                                            alt="Sargood On Collaroy" 
                                            className="h-20 w-auto"
                                            style={{ maxHeight: '85px' }}
                                        />
                                    </a>
                                </Link>
                                
                                {/* Title, notification and avatar in same row */}
                                <div className="flex items-center space-x-4">
                                    {!hideTitleBar && (
                                        <h1 className="page-title mr-6">{title}</h1>
                                    )}
                                    <div className="flex items-center">
                                        <NotificationBell />
                                        {user && <Avatar />}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Desktop Title bar - when sidebar is visible, always show avatar and notification */}
                        {!hideSidebar && (
                            <div className="hidden lg:flex flex-col md:flex-row justify-between mt-4 mr-6">
                                <div className="flex items-center w-full justify-between">
                                    <div className="flex items-center ml-4"> {/* Added ml-4 here for spacing */}
                                        {/* Desktop menu toggle - only for collapse/expand */}
                                        <button 
                                            onClick={toggleCollapse}
                                            className={`p-2 mr-4 rounded transition-colors ${!isCollapsed ? 'bg-[#E3EEF6] hover:bg-[#D4E0E9]' : 'hover:bg-gray-100'}`}
                                            title="Collapse menu"
                                        >
                                            <MenuIcon />
                                        </button>
                                    </div>
                                    {/* Always show NotificationBell and Avatar when sidebar is visible */}
                                    <div className='flex items-center'>
                                        {!hideTitleBar && title && (
                                            <h1 className="page-title mr-6">{title}</h1>
                                        )}
                                        <NotificationBell />
                                        {user && <Avatar />}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Main content - Conditional overflow handling */}
                        <main className={`w-full ${
                            noScroll 
                                ? 'h-screen overflow-hidden' 
                                : useFlexLayout 
                                    ? 'flex-1 overflow-auto' 
                                    : 'h-full overflow-auto'
                        }`}>
                            {children}
                        </main>
                    </div>
                </div>
            )}
            
            <ReactTooltip />
            {(!hideSpinner && loading) && <Spinner small={true} />}
        </div>
    )
}