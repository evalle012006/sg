import { useEffect, useState } from "react";
import EmailManagementPage from "../manage-email-trigger";
import NotificationLibraryPage from "../manage-notification-library";
import dynamic from 'next/dynamic';

const Layout = dynamic(() => import('../../../components/layout'));
const TabButton = dynamic(() => import('../../../components/ui-v2/TabButton'));

export default function ManageEmailPage() {
    // Updated tab state management similar to BookingTemplateList
    const [selectedTab, setSelectedTab] = useState("email-trigger");

    // Tab configuration similar to BookingTemplateList
    const mainTabs = [
        { label: "EMAIL TRIGGER", size: "medium", fullLabel: "EMAIL TRIGGER" },
        { label: "IN-APP NOTIFICATIONS", size: "medium", fullLabel: "IN-APP NOTIFICATIONS" }
    ];

    const handleTabChange = (index) => {
        const tabNames = ["email-trigger", "notification-library"];
        setSelectedTab(tabNames[index]);
    };

    // Save tab to localStorage when it changes
    useEffect(() => {
        if (selectedTab) {
            localStorage.setItem("currentNotificationTab", JSON.stringify(selectedTab));
        }
    }, [selectedTab]);

    // Load tab from localStorage on mount
    useEffect(() => {
        const currentTabLocalStorage = JSON.parse(localStorage.getItem("currentNotificationTab"));
        if (currentTabLocalStorage) {
            setSelectedTab(currentTabLocalStorage);
        }
    }, []);

    // Get current tab content based on selected tab
    const getCurrentTabContent = () => {
        if (selectedTab === "notification-library") {
            return <NotificationLibraryPage />;
        }
        return <EmailManagementPage />;
    };

    return (
        <Layout title="Manage Emails">
            <div className="p-4">
                {/* Main Navigation Tabs */}
                <div className="mb-6">
                    <TabButton
                        tabs={mainTabs}
                        onChange={handleTabChange}
                        type="outline"
                    />
                </div>

                <div className="mt-6">
                    {/* Tab Content */}
                    {getCurrentTabContent()}
                </div>
            </div>
        </Layout>
    );
}