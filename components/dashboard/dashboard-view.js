import React, { useContext, useEffect, useRef, useState, useMemo } from "react";
import dynamic from 'next/dynamic';
import AdminDashboardPage from './admin-dashboard';
import BookingDashboardPage from './booking-dashboard';
import AssetDashboard from '../../pages/assets-management/dashboard';
import { useRouter } from "next/router";
import { AbilityContext, Can } from "./../../services/acl/can";
import TabButton from '../ui-v2/TabButton';

const Layout = dynamic(() => import('../layout'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));

const Dashboards = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [selectedTab, setSelectedTab] = useState("");

    const AdminDashboardRef = useRef();
    const BookingDashboardRef = useRef();
    const AssetDashboardRef = useRef();
    const ability = useContext(AbilityContext);

    // Memoize tab configuration to prevent recreation on every render
    const { availableTabs, tabMapping } = useMemo(() => {
        const tabs = [];
        const mapping = [];

        if (ability.can('Read', 'AdminDashboard')) {
            tabs.push({ label: "MGMT", fullLabel: "MANAGEMENT" });
            mapping.push("admin");
        }
        if (ability.can('Read', 'BookingDashboard')) {
            tabs.push({ label: "BOOKINGS", fullLabel: "BOOKINGS" });
            mapping.push("bookings");
        }
        if (ability.can('Read', 'AssetDashboard')) {
            tabs.push({ label: "ASSETS", fullLabel: "ASSETS" });
            mapping.push("assets");
        }

        return { availableTabs: tabs, tabMapping: mapping };
    }, [ability]);

    // Set initial tab based on permissions
    useEffect(() => {
        if (availableTabs.length > 0 && !selectedTab) {
            // Always select the first available tab
            setSelectedTab(tabMapping[0]);
            setActiveTab(0);
        }
    }, [availableTabs, tabMapping, selectedTab]);

    const reloadDashboardData = async (tabName) => {
        try {
            switch (tabName) {
                case "admin":
                    if (AdminDashboardRef.current?.reloadData) {
                        await AdminDashboardRef.current.reloadData();
                    }
                    break;
                case "bookings":
                    if (BookingDashboardRef.current?.reloadData) {
                        await BookingDashboardRef.current.reloadData();
                    }
                    break;
                case "assets":
                    if (AssetDashboardRef.current?.reloadData) {
                        await AssetDashboardRef.current.reloadData();
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error reloading ${tabName} dashboard data:`, error);
        }
    };

    const handleTabChange = async (index) => {
        console.log(`Tab change requested: index ${index}`); // Debug log
        
        if (index < 0 || index >= tabMapping.length) {
            console.error(`Invalid tab index: ${index}`);
            return;
        }

        const newTab = tabMapping[index];
        console.log(`Switching to tab: ${newTab}`); // Debug log
        
        setLoading(true);
        setActiveTab(index);
        setSelectedTab(newTab);
        
        // Small delay to ensure state is updated before reloading data
        setTimeout(async () => {
            await reloadDashboardData(newTab);
            setLoading(false);
        }, 100);
    };

    // Load initial data when selectedTab changes
    useEffect(() => {
        if (selectedTab && !loading) {
            console.log(`Loading initial data for: ${selectedTab}`); // Debug log
            setLoading(true);
            
            setTimeout(async () => {
                await reloadDashboardData(selectedTab);
                setLoading(false);
            }, 100);
        }
    }, [selectedTab]); // Remove loading from dependencies to avoid infinite loops

    // If no permissions, show no access message
    if (availableTabs.length === 0) {
        return (
            <Layout title={"Dashboards"}>
                <div className="p-4 sm:p-6 lg:p-8 w-full">
                    <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
                                <svg fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Access</h3>
                            <p className="text-gray-500">You do not have access to any dashboard. Contact the administrator.</p>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    console.log(`Current state - activeTab: ${activeTab}, selectedTab: ${selectedTab}`); // Debug log

    return (
        <Layout title={"Dashboards"}>
            <div className="p-4 sm:p-6 lg:p-8 w-full">
                <div className="main-content">
                    {/* Tab Navigation */}
                    <div className="mb-6">
                        <TabButton
                            tabs={availableTabs}
                            activeTab={activeTab}
                            onChange={handleTabChange}
                            type="outline"
                        />
                    </div>

                    {loading ? (
                        <div className='flex items-center justify-center h-64'>
                            <Spinner />
                        </div>
                    ) : (
                        <div className="w-full">
                            {/* Admin Dashboard */}
                            {selectedTab === "admin" && ability.can('Read', 'AdminDashboard') && (
                                <AdminDashboardPage 
                                    ref={AdminDashboardRef}
                                    hideMainTabs={true}
                                />
                            )}
                            
                            {/* Booking Dashboard */}
                            {selectedTab === "bookings" && ability.can('Read', 'BookingDashboard') && (
                                <BookingDashboardPage 
                                    ref={BookingDashboardRef}
                                />
                            )}
                            
                            {/* Asset Dashboard */}
                            {selectedTab === "assets" && ability.can('Read', 'AssetDashboard') && (
                                <AssetDashboard 
                                    ref={AssetDashboardRef} 
                                    origin={'main_dashboard'}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}

export default Dashboards;