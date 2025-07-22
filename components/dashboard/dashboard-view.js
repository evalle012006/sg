import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "../../components/tabSelector";
import React, { useContext, useEffect, useRef, useState } from "react";
import dynamic from 'next/dynamic';
import AdminDashboardPage from './admin-dashboard';
import BookingDashboardPage from './booking-dashboard';
import AssetDashboard from '../../pages/assets-management/dashboard';
import { useRouter } from "next/router";
import { AbilityContext, Can } from "./../../services/acl/can";

const Layout = dynamic(() => import('../layout'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));

const Dashboards = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [currentTab, setCurrentTab] = useState();
    const [selectedTab, setSelectedTab] = useTabs([
        "admin",
        "bookings",
        "assets",
    ]);

    const AdminDashboardRef = useRef();
    const BookingDashboardRef = useRef();
    const AssetDashboardRef = useRef();
    const ability = useContext(AbilityContext);

    const handleTabClicked = (selected) => {
        setSelectedTab(selected);
        setCurrentTab(selected);
        setLoading(true);
        
        // We'll use setTimeout to ensure the tab switching has completed
        // before attempting to call reloadData on the refs
        setTimeout(() => {
            try {
                if (selected === "admin" && AdminDashboardRef.current) {
                    AdminDashboardRef.current.reloadData();
                }
                
                if (selected === "bookings" && BookingDashboardRef.current) {
                    BookingDashboardRef.current.reloadData();
                }
                
                if (selected === "assets" && AssetDashboardRef.current) {
                    AssetDashboardRef.current.reloadData();
                }
            } catch (error) {
                console.error("Error reloading data:", error);
            } finally {
                setLoading(false);
            }
        }, 0);
    }

    useEffect(() => {
        if (currentTab) {
            localStorage.setItem("currentTab", JSON.stringify(currentTab));
        }
    }, [currentTab]);

    useEffect(() => {
        const currentTabLocalStorage = JSON.parse(localStorage.getItem("currentTab"));
        if (currentTabLocalStorage) {
            setSelectedTab(currentTabLocalStorage);
        }
        
        if (ability.can('Read', 'AssetDashboard')) {
            setSelectedTab('assets');
        }
        if (ability.can('Read', 'BookingDashboard')) {
            setSelectedTab('bookings');
        }
        if (ability.can('Read', 'AdminDashboard')) {
            setSelectedTab('admin');
        }
    }, []);

    return (
        <Layout title={"Dashboards"}>
            <div className="p-8 col-span-9">
                <div className="main-content">
                    <nav className="flex border-b border-gray-300">
                        <Can I="Read" a="AdminDashboard"><TabSelector
                            isActive={selectedTab === "admin"}
                            onClick={() => handleTabClicked('admin')}>
                            Management
                        </TabSelector>
                        </Can>
                        <Can I="Read" a="BookingDashboard">
                            <TabSelector
                                isActive={selectedTab === "bookings"}
                                onClick={() => handleTabClicked("bookings")}>
                                Bookings
                            </TabSelector>
                        </Can>
                        <Can I="Read" a="AssetDashboard">
                            <TabSelector
                                isActive={selectedTab === "assets"}
                                onClick={() => handleTabClicked("assets")}>
                                Assets
                            </TabSelector>
                        </Can>
                    </nav>
                    <div className="">
                        {loading ? (
                            <div className='h-screen flex items-center justify-center'>
                                <Spinner />
                            </div>
                        ) : (
                            <React.Fragment>
                                <Can I="Read" a="AdminDashboard">
                                    <TabPanel hidden={selectedTab !== "admin"}>
                                        {selectedTab === "admin" && <AdminDashboardPage ref={AdminDashboardRef} />}
                                    </TabPanel>
                                </Can>
                                <Can I="Read" a="BookingDashboard">
                                    <TabPanel hidden={selectedTab !== 'bookings'}>
                                        {selectedTab === "bookings" && <BookingDashboardPage ref={BookingDashboardRef} />}
                                    </TabPanel>
                                </Can>
                                <Can I="Read" a="AssetDashboard">
                                    <TabPanel hidden={selectedTab !== 'assets'}>
                                        {selectedTab === "assets" && <AssetDashboard ref={AssetDashboardRef} origin={'main_dashboard'} />}
                                    </TabPanel>
                                </Can>
                                {!ability.can('Read', 'AdminDashboard') && !ability.can('Read', 'BookingDashboard') && !ability.can('Read', 'AssetDashboard') && (
                                    <div className="flex items-center justify-center h-96">
                                        <p className="text-gray-500">You do not have access to any dashboard. Contact the administrator.</p>
                                    </div>
                                )}
                            </React.Fragment>
                        )}
                    </div>
                </div>
            </div >
        </Layout >
    )
}

export default Dashboards;