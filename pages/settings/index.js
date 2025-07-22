import Layout from "../../components/layout"
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "../../components/tabSelector";
import UsersPage from "./users";
import AccessControlList from "./accessControlList";
import ManageChecklistPage from "./manage-checklist";
import BookingTemplateList from "./booking-templates";
import ManageRoomSetup from "./manage-room";
import EmailManagementPage from "./manage-email-trigger";
import SmtpConfiguration from "./smtp-configuration";
import { useContext, useEffect, useState } from "react";
import ManageEmailPage from "./manage-emails";
import { AbilityContext, Can } from "../../services/acl/can";

export default function SettingsPage() {
    const [currentTab, setCurrentTab] = useState();
    const [selectedTab, setSelectedTab] = useTabs([
        "users",
        "access-control-list",
        "manage-checklist",
        "booking-templates",
        "room-setup",
        "manage-email",
        "smtp-configuration"
    ]);

    const ability = useContext(AbilityContext);

    const handleTabClicked = (selected) => {
        setSelectedTab(selected);
        setCurrentTab(selected);
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
    }, []);

    return (
        <>
            {(ability.can('manage', 'Setting') || ability.can('manage', 'Checklist')) &&
                <Layout title={"Settings"}>
                    <div className="p-8 col-span-9">
                        <div className="main-content">
                            <nav className="flex border-b border-gray-300">
                                <Can I="manage" a="Setting">
                                    <TabSelector
                                        isActive={selectedTab === "users"}
                                        onClick={() => handleTabClicked('users')}>
                                        Users
                                    </TabSelector>
                                    <TabSelector
                                        isActive={selectedTab === "access-control-list"}
                                        onClick={() => handleTabClicked("access-control-list")}>
                                        Roles & Permissions
                                    </TabSelector>
                                </Can>
                                <Can I="manage" a="Checklist">
                                    <TabSelector
                                        isActive={selectedTab === "manage-checklist"}
                                        onClick={() => handleTabClicked("manage-checklist")}>
                                        Manage Checklist
                                    </TabSelector>
                                </Can>
                                <Can I="manage" a="Setting">
                                    <TabSelector
                                        isActive={selectedTab === "booking-templates"}
                                        onClick={() => handleTabClicked("booking-templates")}>
                                        Booking Templates
                                    </TabSelector>
                                    <TabSelector
                                        isActive={selectedTab === "room-setup"}
                                        onClick={() => handleTabClicked("room-setup")}>
                                        Manage Room Setup
                                    </TabSelector>
                                    <TabSelector
                                        isActive={selectedTab === "manage-email"}
                                        onClick={() => handleTabClicked("manage-email")}>
                                        Manage Emails
                                    </TabSelector>
                                    <TabSelector
                                        isActive={selectedTab === "smtp-configuration"}
                                        onClick={() => handleTabClicked("smtp-configuration")}>
                                        SMTP Configuration
                                    </TabSelector>
                                </Can>
                            </nav>
                            <div className="">
                                <Can I="manage" a="Setting">
                                    <TabPanel hidden={selectedTab !== "users"}>
                                        <UsersPage />
                                    </TabPanel>
                                    <TabPanel hidden={selectedTab !== 'access-control-list'}>
                                        <div className="py-16">
                                            <AccessControlList />
                                        </div>
                                    </TabPanel>
                                </Can>
                                <Can I="manage" a="Checklist">
                                    <TabPanel hidden={selectedTab !== 'manage-checklist'}>
                                        <div className="">
                                            <ManageChecklistPage />
                                        </div>
                                    </TabPanel>
                                </Can>
                                <Can I="manage" a="Setting">
                                    <TabPanel hidden={selectedTab !== 'booking-templates'}>
                                        <div className="">
                                            <BookingTemplateList />
                                        </div>
                                    </TabPanel>
                                    <TabPanel hidden={selectedTab !== 'room-setup'}>
                                        <div className="">
                                            <ManageRoomSetup />
                                        </div>
                                    </TabPanel>
                                    <TabPanel hidden={selectedTab !== 'manage-email'}>
                                        <div className="">
                                            <ManageEmailPage />
                                        </div>
                                    </TabPanel>
                                    <TabPanel hidden={selectedTab !== 'smtp-configuration'}>
                                        <div className="">
                                            <SmtpConfiguration />
                                        </div>
                                    </TabPanel>
                                </Can>
                                <Can not I="manage" a="Setting">
                                    <div className="text-center">You are not authorized to view this page</div>
                                </Can>
                                <Can not I="manage" a="Checklist">
                                    <div className="text-center">You are not authorized to view this page</div>
                                </Can>
                            </div>
                        </div>
                    </div>
                </Layout >
            }
            <Can not I="manage" a="Setting">
                <div className="text-center">You are not authorized to view this page</div>
            </Can>
            <Can not I="manage" a="Checklist">
                <div className="text-center">You are not authorized to view this page</div>
            </Can>
        </>
    )
}