import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { emailTriggerActions } from '../../../store/emailTriggerSlice';
import Spinner from '../../../components/ui/spinner';
import EmailTriggerList from '../../../components/manage-email-trigger/list';

export default function EmailManagementPage() {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    const response = await fetch("/api/email-triggers")

    if (response.ok) {
      const data = await response.json();

      const emailTriggers = [];
      data.map(s => {
        const email_template_str = s.email_template.replaceAll('-', ' ');
        emailTriggers.push({ ...s, label: s.recipient, value: s.recipient, email_template_str: email_template_str});
      });
      
      dispatch(emailTriggerActions.setList(emailTriggers));
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
    <EmailTriggerList refreshData={fetchData} />
  )
}