// pages/settings/manage-email-recipients/index.js
import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Mail, X, Plus, Save } from 'lucide-react';
import { toast } from 'react-toastify';

const Layout = dynamic(() => import('../../../components/layout'));
const Button = dynamic(() => import('../../../components/ui-v2/Button'));
const TextField = dynamic(() => import('../../../components/ui-v2/TextField'));

export default function ManageEmailRecipients() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [emailSettings, setEmailSettings] = useState({
        email_eoi_recipients: { emails: [], raw_value: '' },
        email_admin_recipients: { emails: [], raw_value: '' },
        email_info_recipients: { emails: [], raw_value: '' }
    });
    const [inputValues, setInputValues] = useState({
        email_eoi_recipients: '',
        email_admin_recipients: '',
        email_info_recipients: ''
    });
    const [hasChanges, setHasChanges] = useState({
        email_eoi_recipients: false,
        email_admin_recipients: false,
        email_info_recipients: false
    });

    useEffect(() => {
        loadEmailSettings();
    }, []);

    const loadEmailSettings = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/settings/email-recipients');
            if (response.ok) {
                const data = await response.json();
                setEmailSettings(data);
            } else {
                toast.error('Failed to load email settings');
            }
        } catch (error) {
            console.error('Error loading email settings:', error);
            toast.error('Failed to load email settings');
        } finally {
            setIsLoading(false);
        }
    };

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleAddEmail = (attribute) => {
        const email = inputValues[attribute].trim();
        
        if (!email) {
            return;
        }

        if (!validateEmail(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        const currentEmails = emailSettings[attribute]?.emails || [];
        
        if (currentEmails.includes(email)) {
            toast.error('This email is already added');
            return;
        }

        setEmailSettings(prev => ({
            ...prev,
            [attribute]: {
                ...prev[attribute],
                emails: [...currentEmails, email]
            }
        }));

        setInputValues(prev => ({
            ...prev,
            [attribute]: ''
        }));

        setHasChanges(prev => ({
            ...prev,
            [attribute]: true
        }));
    };

    const handleRemoveEmail = (attribute, emailToRemove) => {
        setEmailSettings(prev => ({
            ...prev,
            [attribute]: {
                ...prev[attribute],
                emails: prev[attribute].emails.filter(email => email !== emailToRemove)
            }
        }));

        setHasChanges(prev => ({
            ...prev,
            [attribute]: true
        }));
    };

    const handleKeyPress = (e, attribute) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddEmail(attribute);
        }
    };

    const handleSave = async (attribute) => {
        setIsSaving(true);
        try {
            const emails = emailSettings[attribute]?.emails || [];

            const response = await fetch('/api/settings/email-recipients', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attribute,
                    emails
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Email recipients updated successfully');
                setHasChanges(prev => ({
                    ...prev,
                    [attribute]: false
                }));
                loadEmailSettings(); // Reload to get the updated data
            } else {
                toast.error(data.message || 'Failed to update email recipients');
            }
        } catch (error) {
            console.error('Error saving email recipients:', error);
            toast.error('Failed to update email recipients');
        } finally {
            setIsSaving(false);
        }
    };

    const getSettingTitle = (attribute) => {
        const titles = {
            email_eoi_recipients: 'EOI Recipients',
            email_admin_recipients: 'Admin Recipients',
            email_info_recipients: 'Info Recipients'
        };
        return titles[attribute] || attribute;
    };

    const getSettingDescription = (attribute) => {
        const descriptions = {
            email_eoi_recipients: 'Email addresses that will receive Expression of Interest (EOI) notifications',
            email_admin_recipients: 'Email addresses that will receive administrative notifications',
            email_info_recipients: 'Email addresses that will receive general information emails'
        };
        return descriptions[attribute] || '';
    };

    const renderEmailSection = (attribute) => {
        const setting = emailSettings[attribute] || { emails: [] };
        const emails = setting.emails || [];

        return (
            <div key={attribute} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                            <Mail className="w-5 h-5 mr-2 text-blue-600" />
                            {getSettingTitle(attribute)}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                            {getSettingDescription(attribute)}
                        </p>
                    </div>
                    {hasChanges[attribute] && (
                        <Button
                            color="primary"
                            size="small"
                            label="SAVE CHANGES"
                            onClick={() => handleSave(attribute)}
                            disabled={isSaving}
                            withIcon={true}
                            iconName="custom"
                            iconSvg={<Save />}
                        />
                    )}
                </div>

                {/* Email Tags */}
                <div className="mb-4">
                    <div className="flex flex-wrap gap-2 min-h-[42px] p-2 border border-gray-300 rounded-lg">
                        {emails.length === 0 ? (
                            <span className="text-gray-400 text-sm">No email addresses added yet</span>
                        ) : (
                            emails.map((email, index) => (
                                <div
                                    key={index}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                                >
                                    <span>{email}</span>
                                    <button
                                        onClick={() => handleRemoveEmail(attribute, email)}
                                        className="hover:text-blue-900 focus:outline-none"
                                        title="Remove email"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Add Email Input */}
                <div className="flex gap-2">
                    <div className="flex-1">
                        <TextField
                            type="email"
                            placeholder="Enter email address"
                            value={inputValues[attribute]}
                            onChange={(value) => setInputValues(prev => ({
                                ...prev,
                                [attribute]: value
                            }))}
                            onKeyPress={(e) => handleKeyPress(e, attribute)}
                        />
                    </div>
                    <Button
                        color="secondary"
                        size="medium"
                        label="ADD EMAIL"
                        onClick={() => handleAddEmail(attribute)}
                        disabled={!inputValues[attribute].trim()}
                        withIcon={true}
                        iconName="custom"
                        iconSvg={<Plus />}
                    />
                </div>

                {/* Email Count */}
                <div className="mt-2 text-sm text-gray-600">
                    {emails.length} email{emails.length !== 1 ? 's' : ''} configured
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <Layout title="Manage Email Recipients">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Manage Email Recipients">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">Manage Email Recipients</h1>
                    <p className="text-gray-600">Configure email addresses for different notification types</p>
                </div>

                {/* Email Sections */}
                <div className="space-y-6">
                    {renderEmailSection('email_eoi_recipients')}
                    {renderEmailSection('email_admin_recipients')}
                    {renderEmailSection('email_info_recipients')}
                </div>

                {/* Help Text */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">How to use:</h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                        <li>Type an email address and press Enter or click &quot;Add Email&quot; to add it</li>
                        <li>Click the X icon on any email tag to remove it</li>
                        <li>Click &quot;Save Changes&quot; to apply your modifications</li>
                        <li>Multiple email addresses can be configured for each type</li>
                    </ul>
                </div>
            </div>
        </Layout>
    );
}