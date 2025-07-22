import React, { useEffect, useState } from 'react';
import Spinner from '../../../components/ui/spinner';
import { useDispatch, useSelector } from 'react-redux';
import { supplierActions } from '../../../store/supplierTypeSlice';
import SupplierList from '../../../components/manage-supplier/list';

export default function ManageSupplier() {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    const response = await fetch("/api/supplier")

    if (response.ok) {
      const suppliers = await response.json();
      dispatch(supplierActions.setList(suppliers));
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
    <SupplierList refreshData={fetchData} />
  )
}