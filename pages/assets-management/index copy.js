import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "../../components/tabSelector";

import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";
import { Can } from "../../services/acl/can";
const AssetEquipmentList = dynamic(() => import('../../components/assets-management/list'));
const Avatar = dynamic(() => import('../../components/avatar'));
const Layout = dynamic(() => import('../../components/layout'));
const CategoryManagement = dynamic(() => import('./category-management'));
const SupplierManagement = dynamic(() => import('./supplier-management'));
const Dashboard = dynamic(() => import('./dashboard'));
const AssetTypeAvailabilityPage = dynamic(() => import('./asset-type-availability'));

export default function AssetManagementPage() {
  const [currentTab, setCurrentTab] = useState();
  const [selectedTab, setSelectedTab] = useTabs([
    // "dashboard",
    "asset-list",
    "asset-type-availability",
    "asset-category-management",
    "supplier-management"
  ]);

  const handleTabClicked = (selected) => {
    setSelectedTab(selected);
    setCurrentTab(selected);
  }

  useEffect(() => {
    if (currentTab) {
      localStorage.setItem("assetCurrentTab", JSON.stringify(currentTab));
    }
  }, [currentTab]);

  useEffect(() => {
    const currentTabLocalStorage = JSON.parse(localStorage.getItem("assetCurrentTab"));
    if (currentTabLocalStorage) {
      setSelectedTab(currentTabLocalStorage);
    }
  }, []);

  return (
    <Layout title="Assets">
      <div className="p-4 lg:p-8 col-span-9">
        <div className="main-content">
          <nav className="flex border-b border-gray-300 overflow-x-auto shadow-inner md:shadow-none">
            {/* <TabSelector
              isActive={selectedTab === "dashboard"}
              onClick={() => handleTabClicked("dashboard")}>
              Dashboard
            </TabSelector> */}
            <TabSelector
              isActive={selectedTab === "asset-list"}
              onClick={() => handleTabClicked("asset-list")}>
              Assets
            </TabSelector>
            <TabSelector
              isActive={selectedTab === "asset-type-availability"}
              onClick={() => handleTabClicked("asset-type-availability")}>
              Asset Type Availability
            </TabSelector>
            <Can I="Create/Edit" a="Equipment">
              <TabSelector
                isActive={selectedTab === "asset-category-management"}
                onClick={() => handleTabClicked("asset-category-management")}>
                Asset Category Management
              </TabSelector>
            </Can>
            <Can I="Create/Edit" a="Equipment">
              <TabSelector
                isActive={selectedTab === "supplier-management"}
                onClick={() => handleTabClicked("supplier-management")}>
                Supplier Management
              </TabSelector>
            </Can>
          </nav>
          <div>
            {/* <TabPanel hidden={selectedTab !== "dashboard"}>
              <Dashboard switchTab={handleTabClicked} />
            </TabPanel> */}
            <TabPanel hidden={selectedTab !== "asset-list"}>
              <AssetEquipmentList />
            </TabPanel>
            <TabPanel hidden={selectedTab !== 'asset-type-availability'}>
              <AssetTypeAvailabilityPage />
            </TabPanel>
            <TabPanel hidden={selectedTab !== 'asset-category-management'}>
              <CategoryManagement />
            </TabPanel>
            <TabPanel hidden={selectedTab !== 'supplier-management'}>
              <SupplierManagement />
            </TabPanel>
          </div>
        </div>
      </div>
    </Layout>
  )
}
