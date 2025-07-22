import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { notificationLibraryActions } from '../../../store/notificationLibrarySlice';
import Spinner from '../../../components/ui/spinner';
import NotificationLibraryList from '../../../components/manage-notification-library/list';

export default function NotificationLibraryPage() {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    const response = await fetch("/api/notification-library")

    if (response.ok) {
      const data = await response.json();
      dispatch(notificationLibraryActions.setList(data));
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    mounted && fetchData();

    return (() => {
      mounted = false;
    });

  }, []);

  if (isLoading) {
    return <div className='h-screen flex items-center justify-center'>
      <Spinner />
    </div>
  }

  return (
    <NotificationLibraryList refreshData={fetchData} />
  )
}