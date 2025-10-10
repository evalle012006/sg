import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch } from 'react-redux';
import { emailTriggerActions } from '../../../store/emailTriggerSlice';
import dynamic from 'next/dynamic';

const Layout = dynamic(() => import('../../../components/layout'));
const Spinner = dynamic(() => import('../../../components/ui/spinner'));
const TabButton = dynamic(() => import('../../../components/ui-v2/TabButton'));
const EmailTriggerList = dynamic(() => import('../../../components/manage-email-trigger/list'));
const EmailTemplateList = dynamic(() => import('../../../components/email-templates/EmailTemplateList'));
const EmailTriggerForm = dynamic(() => import('../../../components/manage-email-trigger/EmailTriggerForm'));
const EmailTemplateBuilder = dynamic(() => import('../../../components/email-templates/EmailTemplateBuilder'));

export default function EmailManagementPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { mode, id, selectedTab: urlSelectedTab, type } = router.query;
  
  // Determine if we're in form mode
  const isFormMode = mode === 'add' || mode === 'edit' || mode === 'view';
  
  // Tab state management - initialize from URL or default to email-triggers
  const [selectedTab, setSelectedTab] = useState(urlSelectedTab || 'email-triggers');
  const [isLoading, setIsLoading] = useState(true);

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

  // Update URL when tab changes (only when not in form mode)
  useEffect(() => {
    if (!isFormMode && selectedTab) {
      const currentPath = router.pathname;
      router.push({
        pathname: currentPath,
        query: { selectedTab }
      }, undefined, { shallow: true });
      localStorage.setItem('emailManagementTab', selectedTab);
    }
  }, [selectedTab, isFormMode]);

  // Sync selectedTab from URL parameter
  useEffect(() => {
    if (urlSelectedTab && !isFormMode) {
      setSelectedTab(urlSelectedTab);
    } else if (!isFormMode) {
      const savedTab = localStorage.getItem('emailManagementTab');
      if (savedTab) {
        setSelectedTab(savedTab);
      }
    }
  }, [urlSelectedTab, isFormMode]);

  const mainTabs = [
    { label: 'EMAIL TRIGGERS', size: 'medium', fullLabel: 'EMAIL TRIGGERS' },
    { label: 'EMAIL TEMPLATES', size: 'medium', fullLabel: 'EMAIL TEMPLATES' }
  ];

  const handleTabChange = (index) => {
    const tabNames = ['email-triggers', 'email-templates'];
    setSelectedTab(tabNames[index]);
  };

  // Handle form navigation
  const handleFormCancel = () => {
    router.push({
      pathname: router.pathname,
      query: { selectedTab }
    });
  };

  const handleFormSuccess = () => {
    fetchData();
    router.push({
      pathname: router.pathname,
      query: { selectedTab }
    });
  };

  const getCurrentTabContent = () => {
    if (selectedTab === 'email-templates') {
      return <EmailTemplateList />;
    }
    return <EmailTriggerList refreshData={fetchData} />;
  };

  // Show loading spinner for initial load
  if (!isFormMode && isLoading && selectedTab === 'email-triggers') {
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
      <div className="p-6">
        {/* TABS AND CONTENT (when not in form mode) */}
        {!isFormMode && (
          <>
            {/* Tab Navigation */}
            <div className="mb-6">
              <TabButton
                tabs={mainTabs}
                activeTab={selectedTab === 'email-templates' ? 1 : 0}
                onChange={handleTabChange}
                type="outline"
              />
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {getCurrentTabContent()}
            </div>
          </>
        )}

        {/* EMAIL TRIGGER FORM VIEW (when in add/edit/view mode for triggers) */}
        {isFormMode && type === 'trigger' && (
          <EmailTriggerForm
            mode={mode}
            triggerId={id}
            onCancel={handleFormCancel}
            onSuccess={handleFormSuccess}
          />
        )}

        {/* EMAIL TEMPLATE FORM VIEW (when in add/edit/view mode for templates) */}
        {isFormMode && type === 'template' && (
          <EmailTemplateBuilder
            mode={mode}
            templateId={id}
            onCancel={handleFormCancel}
            onSuccess={handleFormSuccess}
          />
        )}
      </div>
    </Layout>
  );
}