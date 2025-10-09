import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { emailTriggerActions } from '../../../store/emailTriggerSlice';
import dynamic from 'next/dynamic';

const Layout = dynamic(() => import('../../../components/layout'));
const Spinner = dynamic(() => import('../../../components/ui/spinner'));
const TabButton = dynamic(() => import('../../../components/ui-v2/TabButton'));
const EmailTriggerList = dynamic(() => import('../../../components/manage-email-trigger/list'));
const EmailTemplateList = dynamic(() => import('../../../components/email-templates/EmailTemplateList'));

export default function EmailManagementPage() {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('email-triggers');

  const fetchData = async () => {
    try {
      const response = await fetch("/api/email-triggers");

      if (response.ok) {
        const data = await response.json();

        const emailTriggers = data.map(trigger => ({
          ...trigger,
          label: trigger.recipient,
          value: trigger.recipient,
          template_name: trigger.template?.name || trigger.email_template?.replaceAll('-', ' '),
          template_id: trigger.email_template_id
        }));
        
        dispatch(emailTriggerActions.setList(emailTriggers));
      }
    } catch (error) {
      console.error('Error fetching email triggers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) {
      fetchData();
    }
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (selectedTab) {
      localStorage.setItem('emailManagementTab', selectedTab);
    }
  }, [selectedTab]);

  useEffect(() => {
    const savedTab = localStorage.getItem('emailManagementTab');
    if (savedTab) {
      setSelectedTab(savedTab);
    }
  }, []);

  const mainTabs = [
    { label: 'EMAIL TRIGGERS', size: 'medium', fullLabel: 'EMAIL TRIGGERS' },
    { label: 'EMAIL TEMPLATES', size: 'medium', fullLabel: 'EMAIL TEMPLATES' }
  ];

  const handleTabChange = (index) => {
    const tabNames = ['email-triggers', 'email-templates'];
    setSelectedTab(tabNames[index]);
  };

  const getCurrentTabContent = () => {
    if (selectedTab === 'email-templates') {
      return <EmailTemplateList />;
    }
    return <EmailTriggerList refreshData={fetchData} />;
  };

  if (isLoading && selectedTab === 'email-triggers') {
    return (
      <Layout title="Manage Emails">
        <div className="h-screen flex items-center justify-center">
          <Spinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Manage Emails">
      <div className="p-4">
        {/* Tab Navigation */}
        <div className="mb-6">
          <TabButton
            tabs={mainTabs}
            onChange={handleTabChange}
            type="outline"
          />
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {getCurrentTabContent()}
        </div>
      </div>
    </Layout>
  );
}