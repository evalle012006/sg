import React, { useEffect, useState } from 'react';
import Spinner from '../../../components/ui/spinner';
import { useDispatch, useSelector } from 'react-redux';
import { roomTypeActions } from '../../../store/roomTypeSlice';
import RoomTypeList from '../../../components/manage-room/list';
import Layout from '../../../components/layout';

export default function ManageRoomSetup() {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    const response = await fetch("/api/manage-room")

    if (response.ok) {
      const data = await response.json();
      let roomTypes = [];
      data.map(room => {
        roomTypes.push({
          ...room.data,
          image_url: room.image_url,
          uploading: false
        });
      });

      roomTypes.sort((a, b) => { return a.id - b.id; });

      dispatch(roomTypeActions.setList(roomTypes));
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
    <Layout title="Manage Room Setup">
      <div className="p-4">
        <RoomTypeList refreshData={fetchData} />
      </div>
    </Layout>
  )
}