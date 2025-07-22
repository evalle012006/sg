import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import Layout from '../../../components/layout';

const SmtpConfiguration = () => {
    const [smtpServer, setSmtpServer] = useState('');
    const [smtpPort, setSmtpPort] = useState('');
    const [smtpUsername, setSmtpUsername] = useState('');
    const [smtpPassword, setSmtpPassword] = useState('');
    const [smtpSenderEmail, setSmtpSenderEmail] = useState('');

    //fetch smtp settings from database and set data
    const fetchSmtpSettings = async () => {
        try {
            const response = await fetch('/api/settings/smtp');
            const data = await response.json();
            console.log(data)
            setSmtpServer(data.smtp_host);
            setSmtpPort(data.smtp_port);
            setSmtpUsername(data.smtp_username);
            setSmtpPassword(data.smtp_password);
            setSmtpSenderEmail(data.smtp_sender_email);
        } catch (error) {
            console.error('Error fetching SMTP settings:', error);
        }
    }

    useEffect(() => {
        fetchSmtpSettings();
    }, []);

    const handleSave = async () => {
        //save smtp settings to database
        try {
            const response = await fetch('/api/settings/smtp/update', {
                method: 'POST',
                body: JSON.stringify({
                    smtp_host: smtpServer,
                    smtp_port: smtpPort,
                    smtp_username: smtpUsername,
                    smtp_password: smtpPassword,
                    smtp_sender_email: smtpSenderEmail,
                }),
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.json();

            if (response.status === 200) {
                toast.success(data.message);
            }
        } catch (error) {
            console.error('Error saving SMTP settings:', error);
        }
    };

    return (
        <Layout title="SMTP Configuration">
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">SMTP Configuration</h1>
                <div className="mb-4">
                    <label className="block mb-2">SMTP Server:</label>
                    <input
                        className="border border-gray-300 rounded px-4 py-2 w-full"
                        type="text"
                        value={smtpServer}
                        onChange={(e) => setSmtpServer(e.target.value)}
                    />
                </div>

                <div className="mb-4">
                    <label className="block mb-2">SMTP Port:</label>
                    <input
                        className="border border-gray-300 rounded px-4 py-2 w-full"
                        type="text"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                    />
                </div>

                <div className="mb-4">
                    <label className="block mb-2">SMTP Username:</label>
                    <input
                        className="border border-gray-300 rounded px-4 py-2 w-full"
                        type="text"
                        value={smtpUsername}
                        onChange={(e) => setSmtpUsername(e.target.value)}
                    />
                </div>

                <div className="mb-4">
                    <label className="block mb-2">SMTP Password:</label>
                    <input
                        className="border border-gray-300 rounded px-4 py-2 w-full"
                        type="password"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                    />
                </div>

                <div className="mb-4">
                    <label className="block mb-2">SMTP Email Sender:</label>
                    <input
                        className="border border-gray-300 rounded px-4 py-2 w-full"
                        type="text"
                        value={smtpSenderEmail}
                        onChange={(e) => setSmtpSenderEmail(e.target.value)}
                    />
                </div>

                <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    type="button"
                    onClick={handleSave}
                >
                    Save
                </button>
            </div>
        </Layout>
    );
};

export default SmtpConfiguration;
