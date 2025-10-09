import Image from 'next/image';
import Link from 'next/link'
import { useRouter } from "next/router";
import { useContext, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import collapsedLogo from "/public/sargood-logo.svg";
import logo from "/public/sargood-logo-full.svg";
import { AbilityContext, Can } from "./../services/acl/can";
import { globalActions } from '../store/globalSlice';

export default function Sidebar({ isCollapsed }) {
    const router = useRouter();
    const user = useSelector(state => state.user.user);
    const menuOpen = useSelector(state => state.global.menuOpen);
    const [openSubmenus, setOpenSubmenus] = useState({});
    const dispatch = useDispatch();

    const ability = useContext(AbilityContext);

    const toggleSubmenu = (menuKey) => {
        setOpenSubmenus(prev => ({
            ...prev,
            [menuKey]: !prev[menuKey]
        }));
    };

    const closeMenu = () => {
        dispatch(globalActions.toggleMenu());
    };

    // Check if submenu should be open (either manually opened or if we're on that route)
    const isSubmenuOpen = (menuKey) => {
        if (menuKey === 'assets') {
            return openSubmenus[menuKey] || router.pathname.includes('/assets-management');
        }
        if (menuKey === 'settings') {
            return openSubmenus[menuKey] || router.pathname.includes('/settings');
        }
        return openSubmenus[menuKey];
    };

    // Helper function to determine if a menu item is active
    const isMenuItemActive = (path) => {
        return router && router.pathname.includes(path);
    };

    // Helper function to get icon color
    const getIconColor = (path) => {
        return isMenuItemActive(path) ? "#00467F" : "rgba(255, 255, 255, 0.5)";
    };

    // Helper function to get menu item classes
    const getMenuItemClasses = (path) => {
        return `
            flex items-center py-3 transition-colors duration-200 relative
            ${isMenuItemActive(path) 
                ? "bg-[#FFCE00] text-[#00467F]" 
                : "text-white hover:bg-blue-600"
            }
        `;
    };

    return (
        <div className={`
            h-full min-h-screen bg-[#00467F] text-white transition-all duration-300 flex flex-col
            ${isCollapsed ? 'w-16' : 'w-64 lg:w-64'}
        `}>
            {/* Header */}
            <div className="p-4 border-b border-blue-600 relative">
                {/* Logo Section - Always centered */}
                <div className="flex items-center justify-center">
                    {!isCollapsed && (
                        <div className="relative w-52 h-32">
                            <Image alt="Sargood Logo" layout="fill" objectFit="contain" src={logo.src} priority />
                        </div>
                    )}
                    {isCollapsed && (
                        <div className="relative w-14 h-14">
                            <Image alt="Sargood Logo" layout="fill" objectFit="contain" src={collapsedLogo.src} priority />
                        </div>
                    )}
                </div>
                
                {/* Close Button - Absolutely positioned, doesn't affect logo centering */}
                {menuOpen && (
                    <button
                        onClick={closeMenu}
                        className="lg:hidden absolute top-4 right-4 p-2 text-white hover:bg-blue-600 rounded-md transition-colors duration-200 z-10"
                        aria-label="Close menu"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </button>
                )}
            </div>

            {/* Menu Items */}
            <nav className="flex-1 py-4 overflow-y-auto">
                <ul className="space-y-1">
                    {/* Dashboard */}
                    {user && user.type == 'user' && (ability.can('Read', 'AdminDashboard') || ability.can('Read', 'AssetDashboard') || ability.can('Read', 'BookingDashboard')) && (
                        <li>
                            <Link href="/dashboard">
                                <a 
                                    className={getMenuItemClasses("/dashboard")}
                                    title={isCollapsed ? "Dashboard" : ""}
                                >
                                    {isMenuItemActive("/dashboard") && (
                                        <div className="absolute inset-0 bg-[#FFCE00]"></div>
                                    )}
                                    <div className="relative flex items-center w-full px-4">
                                        <div className="w-6 h-6 flex-shrink-0">
                                            <svg width="23" height="26" viewBox="0 0 23 26" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path fillRule="evenodd" clipRule="evenodd" d="M12.7778 24.2778C12.7778 24.9844 13.3489 25.5556 14.0556 25.5556H17.8889C19.2446 25.5556 20.5441 25.0176 21.5024 24.0593C22.4608 23.1009 23 21.8002 23 20.4444C23 19.711 23 19.1667 23 19.1667C23 18.4613 22.4276 17.8889 21.7222 17.8889H14.0556C13.3489 17.8889 12.7778 18.4613 12.7778 19.1667V24.2778ZM8.94444 25.5556C9.64978 25.5556 10.2222 24.9844 10.2222 24.2778V11.5C10.2222 10.7947 9.64978 10.2222 8.94444 10.2222H1.27778C0.571167 10.2222 0 10.7947 0 11.5V20.4444C0 21.8002 0.537941 23.1009 1.49627 24.0593C2.45461 25.0176 3.75539 25.5556 5.11111 25.5556H8.94444ZM20.4444 20.4444H15.3333V23H17.8889C18.5661 23 19.2165 22.7317 19.6957 22.2525C20.1748 21.7733 20.4444 21.1229 20.4444 20.4444ZM7.66667 23V12.7778H2.55556V20.4444C2.55556 21.1229 2.82389 21.7733 3.30433 22.2525C3.7835 22.7317 4.43261 23 5.11111 23H7.66667ZM14.0556 0C13.3489 0 12.7778 0.572444 12.7778 1.27778V14.0556C12.7778 14.7622 13.3489 15.3333 14.0556 15.3333H21.7222C22.4276 15.3333 23 14.7622 23 14.0556V5.11111C23 3.75667 22.4608 2.45589 21.5024 1.49755C20.5441 0.539218 19.2446 0 17.8889 0H14.0556ZM15.3333 2.55556V12.7778H20.4444V5.11111C20.4444 4.43389 20.1748 3.7835 19.6957 3.30433C19.2165 2.82516 18.5661 2.55556 17.8889 2.55556H15.3333ZM10.2222 1.27778C10.2222 0.572444 9.64978 0 8.94444 0H5.11111C3.75539 0 2.45461 0.539218 1.49627 1.49755C0.537941 2.45589 0 3.75667 0 5.11111C0 5.84456 0 6.38889 0 6.38889C0 7.0955 0.571167 7.66667 1.27778 7.66667H8.94444C9.64978 7.66667 10.2222 7.0955 10.2222 6.38889V1.27778ZM7.66667 2.55556H5.11111C4.43261 2.55556 3.7835 2.82516 3.30433 3.30433C2.82389 3.7835 2.55556 4.43389 2.55556 5.11111H7.66667V2.55556Z" fill={getIconColor("/dashboard")}/>
                                            </svg>
                                        </div>
                                        {!isCollapsed && <span className="ml-3 font-medium">Dashboard</span>}
                                    </div>
                                </a>
                            </Link>
                        </li>
                    )}

                    {/* Bookings */}
                    <Can I="Read" a="Booking">
                        <li>
                            <Link href="/bookings">
                                <a 
                                    className={getMenuItemClasses("/bookings")}
                                    title={isCollapsed ? (user && user.type == 'user' ? 'Bookings' : 'My Bookings') : ""}
                                >
                                    {isMenuItemActive("/bookings") && (
                                        <div className="absolute inset-0 bg-[#FFCE00]"></div>
                                    )}
                                    <div className="relative flex items-center w-full px-4">
                                        <div className="w-6 h-6 flex-shrink-0">
                                            <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path opacity={isMenuItemActive("/bookings") ? "1" : "0.5"} fillRule="evenodd" clipRule="evenodd" d="M8.4 1.21951C8.4 0.546 7.86275 0 7.2 0C6.53727 0 6 0.546 6 1.21951V1.8366C5.40486 1.84606 4.87605 1.8677 4.41027 1.91715C3.54696 2.00883 2.76433 2.20671 2.06832 2.69626C1.59345 3.03027 1.18179 3.44862 0.853117 3.93122C0.371401 4.63855 0.176689 5.4339 0.086485 6.31124C0.00726101 7.08173 0.000589209 8.02194 4.92091e-05 9.14634L1.14388e-06 9.33344C1.14388e-06 9.37609 1.14388e-06 9.41898 1.14388e-06 9.46213V16.5495C-3.48561e-05 18.2009 -7.07388e-05 19.5626 0.142501 20.6404C0.292201 21.7718 0.618565 22.7711 1.4059 23.5712C2.19322 24.3713 3.17653 24.7031 4.28993 24.8551C5.35043 25.0001 6.69035 25 8.31527 25H15.6846C17.3095 25 18.6496 25.0001 19.7101 24.8551C20.8235 24.7031 21.8068 24.3713 22.5941 23.5712C23.3814 22.7711 23.7078 21.7718 23.8576 20.6404C24.0001 19.5626 24 18.2009 24 16.5495V9.46213C24 9.42485 24 9.38766 24 9.35077V9.14634C23.9994 8.02194 23.9928 7.08173 23.9135 6.31124C23.8234 5.4339 23.6286 4.63855 23.1469 3.93122C22.8182 3.44862 22.4065 3.03027 21.9317 2.69626C21.2357 2.20671 20.453 2.00883 19.5898 1.91715C19.1239 1.8677 18.5952 1.84606 18 1.8366V1.21951C18 0.546 17.4628 0 16.8 0C16.1372 0 15.6 0.546 15.6 1.21951V1.82927H8.4V1.21951ZM21.5999 9.14634C21.599 8.00426 21.5915 7.19644 21.5266 6.56472C21.4567 5.88629 21.3316 5.55144 21.1734 5.31927C21.0091 5.07798 20.8033 4.86879 20.5658 4.70178C20.3374 4.5411 20.0078 4.41385 19.3403 4.34296C18.9672 4.30335 18.5316 4.28474 18 4.276V4.87805C18 5.55156 17.4628 6.09756 16.8 6.09756C16.1372 6.09756 15.6 5.55156 15.6 4.87805V4.26829H8.4V4.87805C8.4 5.55156 7.86275 6.09756 7.2 6.09756C6.53727 6.09756 6 5.55156 6 4.87805V4.276C5.46835 4.28474 5.0328 4.30335 4.65969 4.34296C3.99211 4.41385 3.66263 4.5411 3.43416 4.70178C3.19673 4.86879 2.99089 5.07798 2.82657 5.31927C2.66844 5.55144 2.54325 5.88629 2.47349 6.56472C2.40853 7.19644 2.40097 8.00426 2.40011 9.14634H21.5999ZM2.4 11.5854V16.4634C2.4 18.2226 2.40256 19.4191 2.52111 20.3154C2.63502 21.1763 2.83587 21.5751 3.10295 21.8466C3.37003 22.118 3.76246 22.3222 4.60972 22.4379C5.4915 22.5584 6.66903 22.561 8.4 22.561H15.6C17.331 22.561 18.5084 22.5584 19.3903 22.4379C20.2375 22.3222 20.6299 22.118 20.897 21.8466C21.1642 21.5751 21.365 21.1763 21.4789 20.3154C21.5975 19.4191 21.6 18.2226 21.6 16.4634V11.5854H2.4Z" fill={getIconColor("/bookings")}/>                                            
                                            </svg>
                                        </div>
                                        {!isCollapsed && (
                                            <span className="ml-3 font-medium">
                                                {user && user.type == 'user' ? 'Bookings' : 'My Bookings'}
                                            </span>
                                        )}
                                    </div>
                                </a>
                            </Link>
                        </li>
                    </Can>

                    {/* Guests */}
                    {user && user.type == 'user' && (
                        <Can I="Read" a="Guest">
                            <li>
                                <Link href="/guests">
                                    <a 
                                        className={getMenuItemClasses("/guests")}
                                        title={isCollapsed ? "Guests" : ""}
                                    >
                                        {isMenuItemActive("/guests") && (
                                            <div className="absolute inset-0 bg-[#FFCE00]"></div>
                                        )}
                                        <div className="relative flex items-center w-full px-4">
                                            <div className="w-6 h-6 flex-shrink-0">
                                                <svg width="25" height="29" viewBox="0 0 25 29" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <g opacity={isMenuItemActive("/guests") ? "1" : "0.5"}>
                                                        <path d="M12.5986 15.5758C16.3874 15.5758 19.4589 12.5044 19.4589 8.71553C19.4589 4.92669 16.3874 1.85522 12.5986 1.85522C8.80974 1.85522 5.73828 4.92669 5.73828 8.71553C5.73828 12.5044 8.80974 15.5758 12.5986 15.5758Z" stroke={getIconColor("/guests")} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                        <path d="M2 27.3669V24.9267C1.99989 24.1193 2.15882 23.3198 2.46772 22.5738C2.77663 21.8278 3.22942 21.15 3.8003 20.579C4.37119 20.0081 5.04897 19.5551 5.79491 19.2461C6.54084 18.9371 7.34032 18.7781 8.14773 18.7781H17.2241C18.0315 18.7781 18.831 18.9371 19.5769 19.2461C20.3229 19.5551 21.0006 20.0081 21.5715 20.579C22.1424 21.15 22.5952 21.8278 22.9041 22.5738C23.213 23.3198 23.3719 24.1193 23.3718 24.9267V27.3669" stroke={getIconColor("/guests")} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </g>
                                                </svg>
                                            </div>
                                            {!isCollapsed && <span className="ml-3 font-medium">Guests</span>}
                                        </div>
                                    </a>
                                </Link>
                            </li>
                        </Can>
                    )}

                    {/* Courses */}
                    {user && user.type == 'user' && (
                        <li>
                            <Link href="/courses">
                                <a 
                                    className={getMenuItemClasses("/courses")}
                                    title={isCollapsed ? "Courses" : ""}
                                >
                                    {isMenuItemActive("/courses") && (
                                        <div className="absolute inset-0 bg-[#FFCE00]"></div>
                                    )}
                                    <div className="relative flex items-center w-full px-4">
                                        <div className="w-6 h-6 flex-shrink-0">
                                            <svg width="30" height="25" viewBox="0 0 30 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <g opacity={isMenuItemActive("/courses") ? "1" : "0.5"}>
                                                    <path d="M27.9768 5.88197V5.42934C27.9768 3.53537 26.4414 2 24.5474 2H5.20277C3.3088 2 1.77344 3.53537 1.77344 5.42934V19.4037C1.77344 21.2976 3.3088 22.833 5.20277 22.833H24.5474C26.4414 22.833 27.9768 21.2976 27.9768 19.4037V6.5" stroke={getIconColor("/courses")} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M17.5933 18.3773L14.7025 19.0128C14.3962 19.0802 14.135 18.7848 14.2394 18.489L15.0666 16.146L21.5606 10.4398C21.8851 10.1553 22.3188 9.99746 22.7693 9.99993C23.2198 10.0024 23.6514 10.165 23.9721 10.453C24.2965 10.7442 24.4814 11.1402 24.4866 11.5549C24.4918 11.9696 24.3169 12.3694 24 12.6672L17.5933 18.3773Z" fill={getIconColor("/courses")}/>
                                                    <path d="M6.43359 8.21118H17.3482" stroke={getIconColor("/courses")} strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round"/>
                                                    <path d="M6.43359 12.8696H11.8684" stroke={getIconColor("/courses")} strokeWidth="2" strokeMiterlimit="10" strokeLinecap="round"/>
                                                </g>
                                            </svg>
                                        </div>
                                        {!isCollapsed && <span className="ml-3 font-medium">Courses</span>}
                                    </div>
                                </a>
                            </Link>
                        </li>
                    )}

                    {/* Settings */}
                    {user && user.type == 'user' && (ability.can('manage', 'Setting') || ability.can('manage', 'Checklist')) && (
                        <li className='cursor-pointer'>
                            <div
                                onClick={() => toggleSubmenu('settings')}
                                className={getMenuItemClasses("/settings")}
                                title={isCollapsed ? "Settings" : ""}
                            >
                                {isMenuItemActive("/settings") && (
                                    <div className="absolute inset-0 bg-[#FFCE00]"></div>
                                )}
                                <div className="relative flex items-center w-full px-4">
                                    <div className="w-6 h-6 flex-shrink-0">
                                        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M15.2089 19.4388C14.3247 19.4388 13.4604 19.1766 12.7252 18.6854C11.99 18.1941 11.417 17.4959 11.0786 16.679C10.7402 15.8621 10.6517 14.9632 10.8242 14.096C10.9967 13.2288 11.4225 12.4322 12.0477 11.807C12.673 11.1817 13.4695 10.756 14.3367 10.5835C15.204 10.411 16.1029 10.4995 16.9198 10.8379C17.7367 11.1762 18.4349 11.7493 18.9261 12.4844C19.4174 13.2196 19.6795 14.084 19.6795 14.9682C19.6795 16.1539 19.2085 17.291 18.3701 18.1294C17.5317 18.9678 16.3946 19.4388 15.2089 19.4388Z" stroke={getIconColor("/settings")} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M13.9266 2.51547C13.8501 2.51547 13.7857 2.56775 13.7743 2.64428L13.3523 5.12284C13.3 5.42744 13.0711 5.6737 12.7726 5.7563C11.9111 5.97831 11.0844 6.32989 10.3229 6.78682C10.0532 6.94519 9.71364 6.93381 9.45525 6.75196L7.4336 5.31075C7.41015 5.29332 7.38134 5.2812 7.34573 5.2812C7.31691 5.2812 7.27603 5.28726 7.23436 5.32818L5.48853 7.07475C5.43548 7.12703 5.42942 7.21493 5.47109 7.27328L6.92972 9.32447C7.11157 9.57679 7.129 9.91095 6.97065 10.1799C6.51978 10.9475 6.18563 11.7795 5.96891 12.6418C5.89237 12.9464 5.64082 13.1745 5.33017 13.2276L2.88646 13.6375C2.80992 13.6496 2.75765 13.7133 2.75765 13.7898V16.257C2.75765 16.3335 2.80992 16.3971 2.88646 16.4093L5.365 16.8313C5.66964 16.8836 5.91586 17.1124 5.99772 17.411C6.2205 18.2725 6.57208 19.0992 7.02976 19.8607C7.18737 20.1305 7.17599 20.4707 6.99414 20.7284L5.55291 22.75C5.51202 22.8144 5.5173 22.8962 5.57034 22.9493L7.31691 24.6951C7.3571 24.736 7.40409 24.7421 7.42754 24.7421C7.45709 24.7421 7.48664 24.7307 7.51546 24.7125L9.56662 23.2539C9.70152 23.1546 9.86594 23.1076 10.0243 23.1076C10.1584 23.1076 10.2994 23.1425 10.4221 23.213C11.1783 23.6464 11.9868 23.9805 12.8249 24.1973C13.1242 24.273 13.3523 24.5201 13.4053 24.83L13.8153 27.2918C13.8266 27.3676 13.8918 27.4199 13.9676 27.4199H16.4347C16.5105 27.4199 16.5749 27.3676 16.587 27.2918L17.003 24.83C17.05 24.5253 17.2789 24.273 17.5835 24.1973C18.445 23.9745 19.2709 23.635 20.0385 23.1781C20.3082 23.0198 20.6476 23.0311 20.9001 23.213L22.9338 24.6602C22.9565 24.6777 22.9861 24.689 23.021 24.689C23.0505 24.689 23.0914 24.6837 23.1331 24.6428L24.8789 22.8962C24.9319 22.8432 24.9373 22.756 24.8963 22.6969L23.4491 20.6579C23.268 20.4002 23.2559 20.0661 23.4142 19.7963C23.8712 19.0288 24.2114 18.2028 24.4334 17.3413C24.5099 17.042 24.7562 16.8139 25.0669 16.7609L27.528 16.3509C27.6037 16.3388 27.6568 16.2744 27.6568 16.1986H27.6628V13.7314C27.6628 13.6549 27.6098 13.5905 27.5332 13.5791L25.0721 13.1631C24.7675 13.1162 24.5159 12.8873 24.4394 12.5827C24.2167 11.7212 23.8772 10.8952 23.4195 10.1277C23.2619 9.85791 23.2733 9.51768 23.4551 9.26611L24.9024 7.23236C24.9433 7.16795 24.9373 7.08611 24.885 7.03308L23.1384 5.28726C23.0975 5.24634 23.0505 5.24028 23.027 5.24028C22.9982 5.24028 22.9687 5.25165 22.9391 5.26984L20.9175 6.72317C20.6599 6.90423 20.3257 6.91644 20.0567 6.75802C19.2709 6.29505 18.4268 5.94876 17.5425 5.72675C17.2379 5.65022 17.0091 5.39865 16.956 5.08798L16.5461 2.64428C16.534 2.56775 16.4703 2.51547 16.3938 2.51547H13.9266ZM13.9266 1H16.3938C17.2168 1 17.9081 1.587 18.0413 2.39721L18.3746 4.3839C19.0798 4.59395 19.7621 4.87401 20.4119 5.22019L22.0545 4.03934C22.0838 4.01826 22.1138 3.99826 22.1446 3.97932C22.4151 3.81283 22.7202 3.72482 23.027 3.72482C23.4736 3.72482 23.894 3.89931 24.2105 4.21616L25.9563 5.96125C25.9589 5.96382 25.9614 5.96639 25.964 5.96898C26.5143 6.52699 26.6037 7.38077 26.1814 8.04521C26.1672 8.06754 26.1525 8.08947 26.1371 8.11102L24.9574 9.76886C25.2933 10.3948 25.568 11.0566 25.7778 11.7455L27.7778 12.0835C28.5907 12.2149 29.1783 12.9044 29.1783 13.7314V16.1986C29.1783 16.3413 29.1586 16.4794 29.1217 16.6103C28.963 17.2433 28.445 17.7361 27.7743 17.8462L25.7715 18.1798C25.5621 18.868 25.2876 19.5294 24.9513 20.1561L26.1322 21.8198C26.1356 21.8246 26.1389 21.8294 26.1423 21.8342C26.6026 22.499 26.522 23.3964 25.9505 23.9678L24.205 25.7142C24.2015 25.7177 24.1979 25.7212 24.1943 25.7246C23.8789 26.0341 23.4622 26.2045 23.021 26.2045C22.672 26.2045 22.3277 26.0927 22.0466 25.8889L20.3977 24.7155C19.7713 25.0513 19.1093 25.3259 18.4207 25.5356L18.082 27.5404C17.9481 28.3493 17.2568 28.9354 16.4347 28.9354H13.9676C13.1402 28.9354 12.45 28.3474 12.3194 27.5346L11.9864 25.5349C11.333 25.335 10.6935 25.0725 10.0765 24.7509L8.39371 25.9475C8.3711 25.9636 8.34807 25.9791 8.32462 25.9939C8.05152 26.1664 7.74129 26.2575 7.42754 26.2575C6.98684 26.2575 6.5565 26.0786 6.24478 25.7661L4.499 24.0211C3.94138 23.4634 3.84875 22.6069 4.27345 21.9378C4.28801 21.9149 4.30314 21.8924 4.31891 21.8703L5.49232 20.2243C5.14796 19.5905 4.86931 18.9289 4.66013 18.2486L2.63579 17.9039C1.82741 17.7692 1.24219 17.0788 1.24219 16.257V13.7898C1.24219 12.967 1.8288 12.2759 2.63861 12.1424L4.62618 11.809C4.83134 11.1187 5.10069 10.4565 5.43058 9.8313L4.23608 8.15153C3.76763 7.4955 3.84593 6.57147 4.41903 6.00105L6.16255 4.25681C6.16584 4.25348 6.16921 4.25017 6.17254 4.24689C6.48851 3.93661 6.90516 3.76573 7.34573 3.76573C7.69795 3.76573 8.03422 3.8748 8.31976 4.08136L9.95894 5.24989C10.5936 4.90543 11.2552 4.62703 11.935 4.41843L12.2791 2.39746C12.4113 1.58623 13.1004 1 13.9266 1Z" fill={getIconColor("/settings")} stroke={getIconColor("/settings")} strokeWidth="0.8"/>
                                        </svg>
                                    </div>
                                    {!isCollapsed && <span className="ml-3 font-medium flex-1">Settings</span>}
                                </div>
                            </div>

                            {/* Submenu for Settings - Show when not collapsed and submenu is open */}
                            {!isCollapsed && isSubmenuOpen('settings') && (
                                <div className="ml-8 relative">
                                    {/* Continuous left border with top margin */}
                                    <div className="absolute left-0 top-2 bottom-0 w-1 bg-[#D9D9D9]"></div>
                                    
                                    {/* Active item yellow overlay - Fixed positioning with proper Tailwind classes */}
                                    {router.pathname === '/settings/users' && (
                                        <div className="absolute left-0 top-2 w-1 h-10 bg-[#FFCE00]"></div>
                                    )}
                                    {router.pathname === '/settings/manage-roles' && (
                                        <div className="absolute left-0 top-12 w-1 h-10 bg-[#FFCE00]"></div>
                                    )}
                                    {router.pathname === '/settings/booking-templates' && (
                                        <div className="absolute left-0 top-[5.5rem] w-1 h-10 bg-[#FFCE00]"></div>
                                    )}
                                    {router.pathname === '/settings/manage-checklist' && (
                                        <div className="absolute left-0 top-32 w-1 h-10 bg-[#FFCE00]"></div>
                                    )}
                                    {router.pathname === '/settings/manage-room' && (
                                        <div className="absolute left-0 top-[10.5rem] w-1 h-10 bg-[#FFCE00]"></div>
                                    )}
                                    {router.pathname === '/settings/manage-packages' && (
                                        <div className="absolute left-0 top-[13rem] w-1 h-10 bg-[#FFCE00]"></div>
                                    )}
                                    {router.pathname === '/settings/manage-email-trigger' && (
                                        <div className="absolute left-0 top-[15.5rem] w-1 h-10 bg-[#FFCE00]"></div>
                                    )}
                                    {router.pathname === '/settings/manage-emails' && (
                                        <div className="absolute left-0 top-[15.5rem] w-1 h-10 bg-[#FFCE00]"></div>
                                    )}
                                    {router.pathname === '/settings/smtp-configuration' && (
                                        <div className="absolute left-0 top-[17.5rem] w-1 h-10 bg-[#FFCE00]"></div>
                                    )}
                                    
                                    <ul className="relative">
                                        <li>
                                            <Link href="/settings/users">
                                                <a className={`
                                                    flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                    ${router.pathname === '/settings/users' 
                                                        ? 'text-[#FFCE00]' 
                                                        : 'text-gray-300 hover:text-white'
                                                    }
                                                `}>
                                                    <span className="ml-4">Users</span>
                                                </a>
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href="/settings/manage-roles">
                                                <a className={`
                                                    flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                    ${router.pathname === '/settings/manage-roles' 
                                                        ? 'text-[#FFCE00]' 
                                                        : 'text-gray-300 hover:text-white'
                                                    }
                                                `}>
                                                    <span className="ml-4">Roles & Permissions</span>
                                                </a>
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href="/settings/booking-templates">
                                                <a className={`
                                                    flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                    ${router.pathname === '/settings/booking-templates' 
                                                        ? 'text-[#FFCE00]' 
                                                        : 'text-gray-300 hover:text-white'
                                                    }
                                                `}>
                                                    <span className="ml-4">Booking Templates</span>
                                                </a>
                                            </Link>
                                        </li>
                                        <Can I="manage" a="Checklist">
                                            <li>
                                                <Link href="/settings/manage-checklist">
                                                    <a className={`
                                                        flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                        ${router.pathname === '/settings/manage-checklist' 
                                                            ? 'text-[#FFCE00]' 
                                                            : 'text-gray-300 hover:text-white'
                                                        }
                                                    `}>
                                                        <span className="ml-4">Manage Checklist</span>
                                                    </a>
                                                </Link>
                                            </li>
                                        </Can>
                                        <li>
                                            <Link href="/settings/manage-room">
                                                <a className={`
                                                    flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                    ${router.pathname === '/settings/manage-room' 
                                                        ? 'text-[#FFCE00]' 
                                                        : 'text-gray-300 hover:text-white'
                                                    }
                                                `}>
                                                    <span className="ml-4">Manage Room Setup</span>
                                                </a>
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href="/settings/manage-packages">
                                                <a className={`
                                                    flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                    ${router.pathname === '/settings/smtp-configuration' 
                                                        ? 'text-[#FFCE00]' 
                                                        : 'text-gray-300 hover:text-white'
                                                    }
                                                `}>
                                                    <span className="ml-4">Manage Packages</span>
                                                </a>
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href="/settings/manage-email-trigger">
                                                <a className={`
                                                    flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                    ${router.pathname === '/settings/manage-email-trigger' 
                                                        ? 'text-[#FFCE00]' 
                                                        : 'text-gray-300 hover:text-white'
                                                    }
                                                `}>
                                                    <span className="ml-4">Manage Email Triggers</span>
                                                </a>
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href="/settings/manage-emails">
                                                <a className={`
                                                    flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                    ${router.pathname === '/settings/manage-emails' 
                                                        ? 'text-[#FFCE00]' 
                                                        : 'text-gray-300 hover:text-white'
                                                    }
                                                `}>
                                                    <span className="ml-4">Manage In-App Notifications</span>
                                                </a>
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href="/settings/smtp-configuration">
                                                <a className={`
                                                    flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                    ${router.pathname === '/settings/smtp-configuration' 
                                                        ? 'text-[#FFCE00]' 
                                                        : 'text-gray-300 hover:text-white'
                                                    }
                                                `}>
                                                    <span className="ml-4">SMTP Configuration</span>
                                                </a>
                                            </Link>
                                        </li>
                                    </ul>
                                </div>
                            )}
                        </li>
                    )}

                    {/* Assets */}
                    {user && user.type == 'user' && (
                        <Can I="Read" a="Equipment">
                            <li className='cursor-pointer'>
                                <div
                                    onClick={() => toggleSubmenu('assets')}
                                    className={getMenuItemClasses("/assets-management")}
                                    title={isCollapsed ? "Assets" : ""}
                                >
                                    {isMenuItemActive("/assets-management") && (
                                        <div className="absolute inset-0 bg-[#FFCE00]"></div>
                                    )}
                                    <div className="relative flex items-center w-full px-4">
                                        <div className="w-6 h-6 flex-shrink-0">
                                            <svg width="29" height="28" viewBox="0 0 29 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <g opacity={isMenuItemActive("/assets-management") ? "1" : "0.5"}>
                                                    <path d="M8.38889 12.2222L14.7879 15.9166V23.3055L8.38889 26.9999L1.98992 23.3055V15.9166L8.38889 12.2222Z" stroke={getIconColor("/assets-management")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M21.053 12L27.4519 15.6944V23.0833L21.053 26.7778L14.654 23.0833V15.6944L21.053 12Z" stroke={getIconColor("/assets-management")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M15.053 1L21.4519 4.69444V12.0833L15.053 15.7778L8.65399 12.0833V4.69444L15.053 1Z" stroke={getIconColor("/assets-management")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </g>
                                            </svg>
                                        </div>
                                        {!isCollapsed && <span className="ml-3 font-medium flex-1">Assets</span>}
                                    </div>
                                </div>

                                {/* Submenu for Assets - Show when not collapsed and submenu is open */}
                                {!isCollapsed && isSubmenuOpen('assets') && (
                                    <div className="ml-8 relative">
                                        {/* Continuous left border with top margin */}
                                        <div className="absolute left-0 top-2 bottom-0 w-1 bg-[#D9D9D9]"></div>
                                        
                                        {/* Active item yellow overlay - Fixed positioning with proper Tailwind classes */}
                                        {router.pathname === '/assets-management' && (
                                            <div className="absolute left-0 top-2 w-1 h-10 bg-[#FFCE00]"></div>
                                        )}
                                        {router.pathname === '/assets-management/asset-type-availability' && (
                                            <div className="absolute left-0 top-12 w-1 h-10 bg-[#FFCE00]"></div>
                                        )}
                                        {router.pathname === '/assets-management/category-management' && (
                                            <div className="absolute left-0 top-[5.5rem] w-1 h-10 bg-[#FFCE00]"></div>
                                        )}
                                        {router.pathname === '/assets-management/supplier-management' && (
                                            <div className="absolute left-0 top-32 w-1 h-10 bg-[#FFCE00]"></div>
                                        )}
                                        
                                        <ul className="relative">
                                            <li>
                                                <Link href="/assets-management">
                                                    <a className={`
                                                        flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                        ${router.pathname === '/assets-management' 
                                                            ? 'text-[#FFCE00]' 
                                                            : 'text-gray-300 hover:text-white'
                                                        }
                                                    `}>
                                                        <span className="ml-4">Assets</span>
                                                    </a>
                                                </Link>
                                            </li>
                                            <li>
                                                <Link href="/assets-management/asset-type-availability">
                                                    <a className={`
                                                        flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                        ${router.pathname === '/assets-management/asset-type' 
                                                            ? 'text-[#FFCE00]' 
                                                            : 'text-gray-300 hover:text-white'
                                                        }
                                                    `}>
                                                        <span className="ml-4">Asset Type Availability</span>
                                                    </a>
                                                </Link>
                                            </li>
                                            <Can I="Create/Edit" a="Equipment">
                                                <li>
                                                    <Link href="/assets-management/category-management">
                                                        <a className={`
                                                            flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                            ${router.pathname === '/assets-management/asset-category' 
                                                                ? 'text-[#FFCE00]' 
                                                                : 'text-gray-300 hover:text-white'
                                                            }
                                                        `}>
                                                            <span className="ml-4">Asset Category</span>
                                                        </a>
                                                    </Link>
                                                </li>
                                            </Can>
                                            <Can I="Create/Edit" a="Equipment">
                                                <li>
                                                    <Link href="/assets-management/supplier-management">
                                                        <a className={`
                                                            flex items-center px-4 py-2 text-sm transition-colors duration-200 h-10
                                                            ${router.pathname === '/assets-management/asset-supplier' 
                                                                ? 'text-[#FFCE00]' 
                                                                : 'text-gray-300 hover:text-white'
                                                            }
                                        `}>
                                                            <span className="ml-4">Asset Supplier</span>
                                                        </a>
                                                    </Link>
                                                </li>
                                            </Can>
                                        </ul>
                                    </div>
                                )}
                            </li>
                        </Can>
                    )}

                    {/* Promotions */}
                    {user && user.type == 'user' && (
                        <li>
                            <Link href="/promotions">
                                <a 
                                    className={getMenuItemClasses("/promotions")}
                                    title={isCollapsed ? "Promotions" : ""}
                                >
                                    {isMenuItemActive("/promotions") && (
                                        <div className="absolute inset-0 bg-[#FFCE00]"></div>
                                    )}
                                    <div className="relative flex items-center w-full px-4">
                                        <div className="w-6 h-6 flex-shrink-0">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <g opacity={isMenuItemActive("/promotions") ? "1" : "0.5"}>
                                                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke={getIconColor("/promotions")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </g>
                                            </svg>
                                        </div>
                                        {!isCollapsed && <span className="ml-3 font-medium">Promotions</span>}
                                    </div>
                                </a>
                            </Link>
                        </li>
                    )}

                    {/* Reports */}
                    {user && user.type == 'user' && (
                        <li>
                            <Link href="/reports">
                                <a 
                                    className={getMenuItemClasses("/reports")}
                                    title={isCollapsed ? "Reports" : ""}
                                >
                                    {isMenuItemActive("/reports") && (
                                        <div className="absolute inset-0 bg-[#FFCE00]"></div>
                                    )}
                                    <div className="relative flex items-center w-full px-4">
                                        <div className="w-6 h-6 flex-shrink-0">
                                            <svg width="23" height="28" viewBox="0 0 23 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <g opacity={isMenuItemActive("/reports") ? "1" : "0.5"}>
                                                    <path d="M12.9744 26.7395H3.02756C2.48982 26.7395 1.97409 26.5259 1.59385 26.1456C1.21361 25.7654 1 25.2497 1 24.712V3.02756C1 2.48982 1.21361 1.97409 1.59385 1.59385C1.97409 1.21361 2.48982 1 3.02756 1H19.6217C20.1595 1 20.6754 1.21358 21.0557 1.5938C21.4361 1.97402 21.6499 2.48974 21.6501 3.02756V19.534L13.1268 26.7379V18.7145H20.7076" stroke={getIconColor("/reports")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M5.32031 6.32227H16.9308" stroke={getIconColor("/reports")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M5.32031 11.5298H16.9308" stroke={getIconColor("/reports")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    <path d="M5.32031 16.7368H9.41805" stroke={getIconColor("/reports")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </g>
                                            </svg>
                                        </div>
                                        {!isCollapsed && <span className="ml-3 font-medium">Reports</span>}
                                    </div>
                                </a>
                            </Link>
                        </li>
                    )}
                </ul>
            </nav>
        </div>
    )
}