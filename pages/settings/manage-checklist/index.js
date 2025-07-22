import React, { useEffect, useState } from 'react';
import Spinner from '../../../components/ui/spinner';
import { useDispatch, useSelector } from 'react-redux';
import { checklistActions } from '../../../store/checklistSlice';
import CheckList from '../../../components/manage-checklist/list';
import dynamic from 'next/dynamic';

const Layout = dynamic(() => import('../../../components/layout'));

export default function ManageChecklistPage() {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    const response = await fetch("/api/manage-checklist")

    if (response.ok) {
      dispatch(checklistActions.setList(await response.json()));
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
    <Layout title="Manage Checklist">
      <div className="p-4">
        <CheckList />
      </div>
    </Layout>
  )
}