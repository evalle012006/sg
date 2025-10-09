import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { notificationLibraryActions } from "../../../store/notificationLibrarySlice";
import dynamic from 'next/dynamic';

const Spinner = dynamic(() => import('../../../components/ui/spinner'));
const NotificationLibraryList = dynamic(() => import('../../../components/manage-notification-library/list'));

export default function NotificationLibraryPage() {
    const dispatch = useDispatch();
    const [isLoading, setIsLoading] = useState(true);

    const fetchNotificationLibrary = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/notification-library/list', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                dispatch(notificationLibraryActions.setNotificationLibraryList(data));
            }
        } catch (error) {
            console.error('Error fetching notification library:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchNotificationLibrary();
    }, []);

    if (isLoading) {
        return (
            <div className='h-screen flex items-center justify-center'>
                <Spinner />
            </div>
        );
    }

    return (
        <div>
            <NotificationLibraryList refreshData={fetchNotificationLibrary} />
        </div>
    );
}