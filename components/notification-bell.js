import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import dynamic from 'next/dynamic';
import { toast } from "react-toastify";
import { notificationActions } from '../store/notificationSlice';

const Notification = dynamic(() => import('./notification'));

export default function NotificationBell() {
    const [dropdownStatus, setDropdownStatus] = useState(false);
    const dispatch = useDispatch();
    const user = useSelector((state) => state.user.user);
    const notifications = useSelector(state => state.notifications.notifications);
    const [counter, setCounter] = useState();

    const fetchNotifications = async () => {
        const res = await fetch('/api/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: user?.id, user_type: user?.type })
        });

        const data = await res.json();

        if (data.success) {
            const list = data?.notifications?.map(notif => {
                if (notif.notifyee_type == 'guest') {
                    const guestFullName = `${notif.Guest?.first_name} ${notif.Guest?.last_name}`;
                    return {...notif, createdBy: guestFullName};
                } else {
                    const userFullName = `${notif.User?.first_name} ${notif.User?.last_name}`;
                    return {...notif, createdBy: userFullName};
                }
            });
            dispatch(notificationActions.setNotifications(list));
        }
    }

    const handleRead = async (notification) => {
        const response = await fetch('/api/notifications/read', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notification_id: notification.id })
        });

        if (response.ok) {
            fetchNotifications();
        }
    }

    const handleReadAll = async () => {
        const response = await fetch('/api/notifications/read-all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ guestId: user.id })
        });

        if (response.ok) {
            fetchNotifications();
        }
    }

    useEffect(() => {
        let mounted = true;

        mounted && fetchNotifications();

        return (() => {
            mounted = false;
        });
    }, []);

    useEffect(() => {
        if (notifications && notifications.length > 0) {
            setCounter(notifications.filter(notification => notification.read == false).length);
        }
    }, [notifications]);

    return (
        <div className="relative cursor-pointer my-auto text-xs md:text-md">
            {user && (
                <div className="flex justify-end md:justify-start mr-6" onClick={() => setDropdownStatus(true)}>
                    <div className="relative">
                        <div className='relative w-7 h-7'>
                            <Image alt='' layout='fill' objectFit="contain" src="/icons/bell.png" />
                        </div>
                        {counter > 0 && (
                            <div className={`py-0.5 ${counter < 10 ? 'px-[7px]' : 'px-1'} bg-red-500 rounded-full text-center text-white text-xs absolute -top-1 -right-2`}>
                                {counter}
                                <div className="absolute top-0.5 left-0 start-0 rounded-full -z-10 animate-ping bg-red-200 w-full h-full"></div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {dropdownStatus && (
                <div className="absolute z-50 top-12 right-0 md:-right-10 shadow-xl rounded-lg border border-gray-200 bg-white w-80 md:w-96">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                            {counter > 0 && (
                                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    {counter}
                                </span>
                            )}
                        </div>
                        {notifications.length > 0 && (
                            <button
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                onClick={handleReadAll}
                            >
                                MARK ALL AS READ
                            </button>
                        )}
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map((notification) => (
                                <Notification 
                                    key={notification.id} 
                                    data={notification} 
                                    handleRead={handleRead} 
                                />
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-5 5v-5zM9 17H4l5 5v-5zM12 3v18" />
                                    </svg>
                                </div>
                                <p className="text-gray-500 text-sm">No notifications yet</p>
                                <p className="text-gray-400 text-xs mt-1">You&apos;re all caught up!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {dropdownStatus && (
                <div 
                    className="fixed z-10 inset-0" 
                    onClick={() => setDropdownStatus(false)}
                ></div>
            )}
        </div>
    )
}