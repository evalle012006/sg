import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/modal";
import { toast } from 'react-toastify';
import { useDispatch, useSelector } from "react-redux";
import { templateActions } from "../../../store/templateSlice";
import dynamic from 'next/dynamic';
import { 
    Edit, 
    Trash2, 
    Archive, 
    RotateCcw, 
    Settings, 
    Check, 
    Copy,
    Plus
} from 'lucide-react';

const Layout = dynamic(() => import('../../../components/layout'));
const TabButton = dynamic(() => import('../../../components/ui-v2/TabButton'));
const Table = dynamic(() => import('../../../components/ui-v2/Table'));
const Button = dynamic(() => import('../../../components/ui-v2/Button'));

export default function BookingTemplateList() {
    const router = useRouter();
    const dispatch = useDispatch();
    const list = useSelector(state => state.builder.list);
    const [activeData, setActiveData] = useState([]);
    const [archivedData, setArchivedData] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [defaultTemplateSettings, setDefaultTemplateSettings] = useState({ value: null });

    // Updated tab state management similar to GuestPage
    const [selectedTab, setSelectedTab] = useState("active-templates");

    // Tab configuration similar to GuestPage
    const mainTabs = [
        { label: "ACTIVE", size: "medium", fullLabel: "ACTIVE TEMPLATES" },
        { label: "ARCHIVED", size: "medium", fullLabel: "ARCHIVED TEMPLATES" }
    ];

    const handleTabChange = (index) => {
        const tabNames = ["active-templates", "archived-templates"];
        setSelectedTab(tabNames[index]);
    };

    // Save tab to localStorage when it changes
    useEffect(() => {
        if (selectedTab) {
            localStorage.setItem("currentTemplateTab", JSON.stringify(selectedTab));
        }
    }, [selectedTab]);

    // Load tab from localStorage on mount
    useEffect(() => {
        const currentTabLocalStorage = JSON.parse(localStorage.getItem("currentTemplateTab"));
        if (currentTabLocalStorage) {
            setSelectedTab(currentTabLocalStorage);
        }
    }, []);

    useEffect(() => {
        fetchTemplates();
        fetchDefaultTemplateSettings();
    }, []);

    const fetchTemplates = async () => {
        const response = await fetch("/api/booking-templates");
        const data = await response.json();
        
        let templates = data.map(template => ({
            ...template,
            no_of_pages: template.Pages.length,
            no_of_questions: template.Pages.reduce((total, page) => 
                total + page.Sections.reduce((secTotal, section) => 
                    secTotal + section.Questions.length, 0), 0)
        }));

        const active = templates.filter(t => !t.archived);
        const archived = templates.filter(t => t.archived);
        
        setActiveData(active);
        setArchivedData(archived);
        dispatch(templateActions.setList(active));
    };

    const fetchDefaultTemplateSettings = async () => {
        const response = await fetch("/api/settings/default-template");
        const data = await response.json();
        setDefaultTemplateSettings(data);
    };

    const deleteTemplate = async () => {
        await fetch(`/api/booking-templates/${selectedTemplate.uuid}`, {
            method: "DELETE",
        }).then((res) => {
            if (res.status === 200) {
                setShowModal(false);
                fetchTemplates();
                toast("Template deleted sucessfully.", { type: 'success' });
            }
            else toast("Sorry, something went wrong. Please try again.", { type: 'error' });

        }).catch((error) => {
            toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        });
    };

    const setActiveTemplate = async (selected) => {
        await fetch(`/api/booking-templates/set-active`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(selected),
        }).then((res) => {
            if (res.status === 200) {
                toast("Template sucessfully set as active.", { type: 'success' });
                fetchDefaultTemplateSettings();
            }
            else toast("Sorry, something went wrong. Please try again.", { type: 'error' });

        }).catch((error) => {
            toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        });
    }

    const duplicateTemplate = async (selected) => {
        await fetch(`/api/booking-templates/duplicate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uuid: selected.uuid }),
        }).then((res) => {
            if (res.status === 200) {
                toast("Template sucessfully duplicated.", { type: 'success' });

                setTimeout(fetchTemplates, 2000);
            }
            else toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        }).catch((error) => {
            toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        });
    }

    const archiveTemplate = async () => {
        try {
            const response = await fetch(`/api/booking-templates/${selectedTemplate.uuid}/archive`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
            });
            
            if (response.status === 200) {
                setShowArchiveModal(false);
                fetchTemplates();
                toast("Template archived successfully.", { type: 'success' });
            } else {
                toast("Sorry, something went wrong. Please try again.", { type: 'error' });
            }
        } catch (error) {
            toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        }
    };

    const restoreTemplate = async () => {
        try {
            const response = await fetch(`/api/booking-templates/${selectedTemplate.uuid}/restore`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
            });
            
            if (response.status === 200) {
                setShowRestoreModal(false);
                fetchTemplates();
                toast("Template restored successfully.", { type: 'success' });
            } else {
                toast("Sorry, something went wrong. Please try again.", { type: 'error' });
            }
        } catch (error) {
            toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        }
    };

    // Updated columns configuration similar to GuestList
    const activeColumns = useMemo(() => [
        {
            key: 'name',
            label: 'NAME',
            searchable: true,
            render: (value) => (
                <span className="font-medium text-gray-900">{value}</span>
            )
        },
        {
            key: 'no_of_pages',
            label: 'NO OF PAGES',
            searchable: false,
            render: (value) => (
                <span className="text-gray-600">{value}</span>
            )
        },
        {
            key: 'no_of_questions',
            label: 'NO OF QUESTIONS',
            searchable: false,
            render: (value) => (
                <span className="text-gray-600">{value}</span>
            )
        },
        {
            key: 'actions',
            label: 'ACTION',
            searchable: false,
            render: (value, row) => (
                <div className="flex items-center space-x-2">
                    <button 
                        title="Edit" 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push('/settings/booking-templates/builder?template_uuid=' + row.uuid);
                        }}
                    >
                        <Edit className="w-4 h-4" />
                    </button>

                    <button 
                        title="Delete" 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#dc26261A', color: '#dc2626' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTemplate(row);
                            setShowModal(true);
                        }}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>

                    <button 
                        title="Move this template to archive list" 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#f59e0b1A', color: '#f59e0b' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTemplate(row);
                            setShowArchiveModal(true);
                        }}
                    >
                        <Archive className="w-4 h-4" />
                    </button>

                    <button 
                        title="Manage conditionals" 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#8b5cf61A', color: '#8b5cf6' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push('/settings/booking-templates/conditionalsBuilder?template_uuid=' + row.uuid);
                        }}
                    >
                        <Settings className="w-4 h-4" />
                    </button>

                    <button 
                        title="Set as active template" 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ 
                            backgroundColor: row.id == parseInt(defaultTemplateSettings.value) ? '#10b9811A' : '#6b72801A', 
                            color: row.id == parseInt(defaultTemplateSettings.value) ? '#10b981' : '#6b7280' 
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTemplate(row);
                        }}
                    >
                        <Check className="w-4 h-4" />
                    </button>

                    <button 
                        title="Duplicate this template" 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#06b6d41A', color: '#06b6d4' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            duplicateTemplate(row);
                        }}
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], [router, defaultTemplateSettings]);

    const archivedColumns = useMemo(() => [
        {
            key: 'name',
            label: 'NAME',
            searchable: true,
            render: (value) => (
                <span className="font-medium text-gray-900">{value}</span>
            )
        },
        {
            key: 'no_of_pages',
            label: 'NO OF PAGES',
            searchable: false,
            render: (value) => (
                <span className="text-gray-600">{value}</span>
            )
        },
        {
            key: 'no_of_questions',
            label: 'NO OF QUESTIONS',
            searchable: false,
            render: (value) => (
                <span className="text-gray-600">{value}</span>
            )
        },
        {
            key: 'actions',
            label: 'ACTION',
            searchable: false,
            render: (value, row) => (
                <div className="flex items-center space-x-2">
                    <button 
                        title="Restore template" 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#10b9811A', color: '#10b981' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTemplate(row);
                            setShowRestoreModal(true);
                        }}
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], []);

    // Get current data based on selected tab
    const getCurrentData = () => {
        if (selectedTab === "archived-templates") {
            return archivedData;
        }
        return activeData;
    };

    const getCurrentColumns = () => {
        if (selectedTab === "archived-templates") {
            return archivedColumns;
        }
        return activeColumns;
    };

    return (
        <Layout title={"Booking Templates"}>
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
                    {/* New Template Button */}
                    {selectedTab === "active-templates" && (
                        <div className="flex justify-end mb-6">
                            <Button
                                color="secondary"
                                size="medium"
                                label="New Template"
                                onClick={() => router.push('/settings/booking-templates/builder?type=new')}
                                withIcon={true}
                                iconName="custom"
                                iconSvg={<Plus />}
                            />
                        </div>
                    )}

                    {/* Table */}
                    {getCurrentData().length > 0 ? (
                        <Table 
                            data={getCurrentData()} 
                            columns={getCurrentColumns()}
                            itemsPerPageOptions={[10, 15, 25, 50]}
                            defaultItemsPerPage={15}
                        />
                    ) : (
                        <div className="flex justify-center items-center h-96">
                            <div className="text-center">
                                <h1 className="text-2xl font-bold">
                                    {selectedTab === "archived-templates" ? "No archived templates" : "No templates found"}
                                </h1>
                                <p className="text-gray-500">
                                    {selectedTab === "archived-templates" 
                                        ? "Archived templates will appear here" 
                                        : "Click on the button below to create a new template."
                                    }
                                </p>
                                {selectedTab === "active-templates" && (
                                    <div className="mt-5">
                                        <Button
                                            color="secondary"
                                            size="medium"
                                            label="New Template"
                                            onClick={() => router.push('/settings/booking-templates/builder?type=new')}
                                            withIcon={true}
                                            iconName="custom"
                                            iconSvg={<Plus />}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
        
                {/* Modals */}
                {showModal && (
                    <Modal 
                        title="Delete selected template?"
                        description="Selected template will be permanently removed."
                        onClose={() => {
                            setSelectedTemplate(null);
                            setShowModal(false);
                        }}
                        onConfirm={() => {
                            deleteTemplate();
                            setShowModal(false);
                        }} 
                    />
                )}
        
                {showArchiveModal && (
                    <Modal 
                        title="Archive selected template?"
                        description="Selected template will be moved to archives."
                        confirmLabel="Archive"
                        confirmColor="text-sargood-blue"
                        onClose={() => {
                            setSelectedTemplate(null);
                            setShowArchiveModal(false);
                        }}
                        onConfirm={() => {
                            archiveTemplate();
                            setShowArchiveModal(false);
                        }} 
                    />
                )}
        
                {showRestoreModal && (
                    <Modal 
                        title="Restore selected template?"
                        description="Selected template will be moved back to active templates."
                        confirmLabel="Restore"
                        confirmColor="text-sargood-blue"
                        onClose={() => {
                            setSelectedTemplate(null);
                            setShowRestoreModal(false);
                        }}
                        onConfirm={() => {
                            restoreTemplate();
                            setShowRestoreModal(false);
                        }} 
                    />
                )}
            </div>
        </Layout>
    );
}