import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/modal";
import { toast } from 'react-toastify';
import { useDispatch, useSelector } from "react-redux";
import { templateActions, createTemplate } from "../../../store/templateSlice";
import dynamic from 'next/dynamic';
import { 
    Edit, 
    Trash2, 
    Archive, 
    RotateCcw, 
    Settings, 
    Check, 
    Copy,
    Plus,
    Home
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

    // ── New Template dialog state ─────────────────────────────────────────────
    const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateType, setNewTemplateType] = useState(null); // 'funded' | 'accommodation_only'
    const [creatingTemplate, setCreatingTemplate] = useState(false);

    // Tab state
    const [selectedTab, setSelectedTab] = useState("active-templates");

    const mainTabs = [
        { label: "ACTIVE", size: "medium", fullLabel: "ACTIVE TEMPLATES" },
        { label: "ARCHIVED", size: "medium", fullLabel: "ARCHIVED TEMPLATES" }
    ];

    const handleTabChange = (index) => {
        const tabNames = ["active-templates", "archived-templates"];
        setSelectedTab(tabNames[index]);
    };

    useEffect(() => {
        if (selectedTab) {
            localStorage.setItem("currentTemplateTab", JSON.stringify(selectedTab));
        }
    }, [selectedTab]);

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
        }).catch(() => {
            toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        });
    };

    const setActiveTemplate = async (selected, settingAttribute = 'default_template') => {
        await fetch(`/api/booking-templates/set-active`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: selected.id, settingAttribute }),
        }).then((res) => {
            if (res.status === 200) {
                const label = settingAttribute === 'accommodation_only_template'
                    ? 'Accommodation-only template updated.'
                    : 'Template successfully set as active.';
                toast(label, { type: 'success' });
                fetchDefaultTemplateSettings();
            }
            else toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        }).catch(() => {
            toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        });
    };

    const duplicateTemplate = async (selected) => {
        await fetch(`/api/booking-templates/duplicate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuid: selected.uuid }),
        }).then((res) => {
            if (res.status === 200) {
                toast("Template sucessfully duplicated.", { type: 'success' });
                setTimeout(fetchTemplates, 2000);
            }
            else toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        }).catch(() => {
            toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        });
    };

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
        } catch {
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
        } catch {
            toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        }
    };

    // ── New Template dialog handler ────────────────────────────────────────────
    const openNewTemplateDialog = () => {
        setNewTemplateName('');
        setNewTemplateType(null);
        setShowNewTemplateDialog(true);
    };

    const handleCreateNewTemplate = async () => {
        if (!newTemplateName.trim() || !newTemplateType) return;

        setCreatingTemplate(true);
        try {
            const result = await dispatch(createTemplate({
                name: newTemplateName.trim(),
                type: newTemplateType,
            }));

            if (result.payload?.uuid) {
                setShowNewTemplateDialog(false);
                setNewTemplateName('');
                setNewTemplateType(null);
                router.push('/settings/booking-templates/builder?template_uuid=' + result.payload.uuid);
            } else {
                toast('Sorry, something went wrong. Please try again.', { type: 'error' });
            }
        } catch {
            toast('Sorry, something went wrong. Please try again.', { type: 'error' });
        } finally {
            setCreatingTemplate(false);
        }
    };

    // ── Columns ───────────────────────────────────────────────────────────────
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
        // ── NEW: Template type column ─────────────────────────────────────────
        {
            key: 'type',
            label: 'TYPE',
            searchable: false,
            render: (value) => {
                if (value === 'accommodation_only') {
                    return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            Accommodation Only
                        </span>
                    );
                }
                if (value === 'funded') {
                    return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            Funded
                        </span>
                    );
                }
                return <span className="text-gray-400 text-xs">—</span>;
            }
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

                    {/* Set as funded/default template */}
                    <button 
                        title={
                            row.id == parseInt(defaultTemplateSettings?.default_template?.value)
                                ? 'Active funded template'
                                : 'Set as funded template'
                        }
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ 
                            backgroundColor: row.id == parseInt(defaultTemplateSettings?.default_template?.value)
                                ? '#10b9811A' : '#6b72801A', 
                            color: row.id == parseInt(defaultTemplateSettings?.default_template?.value)
                                ? '#10b981' : '#6b7280' 
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTemplate(row, 'default_template');
                        }}
                    >
                        <Check className="w-4 h-4" />
                    </button>

                    {/* Set as accommodation-only template */}
                    <button 
                        title={
                            row.id == parseInt(defaultTemplateSettings?.accommodation_only_template?.value)
                                ? 'Active accommodation-only template'
                                : 'Set as accommodation-only template'
                        }
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ 
                            backgroundColor: row.id == parseInt(defaultTemplateSettings?.accommodation_only_template?.value)
                                ? '#3b82f61A' : '#6b72801A',
                            color: row.id == parseInt(defaultTemplateSettings?.accommodation_only_template?.value)
                                ? '#3b82f6' : '#6b7280'
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTemplate(row, 'accommodation_only_template');
                        }}
                    >
                        <Home className="w-4 h-4" />
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
            key: 'type',
            label: 'TYPE',
            searchable: false,
            render: (value) => {
                if (value === 'accommodation_only') {
                    return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            Accommodation Only
                        </span>
                    );
                }
                if (value === 'funded') {
                    return (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            Funded
                        </span>
                    );
                }
                return <span className="text-gray-400 text-xs">—</span>;
            }
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

    const getCurrentData = () => selectedTab === "archived-templates" ? archivedData : activeData;
    const getCurrentColumns = () => selectedTab === "archived-templates" ? archivedColumns : activeColumns;

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
                                onClick={openNewTemplateDialog}
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
                                            onClick={openNewTemplateDialog}
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
        
                {/* ── Modals ────────────────────────────────────────────────────────── */}

                {/* New Template Type Dialog */}
                {showNewTemplateDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">New Booking Template</h2>
                            <p className="text-sm text-gray-500 mb-5">Choose the type of booking this template is for.</p>

                            {/* Template name */}
                            <div className="mb-5">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Template Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newTemplateName}
                                    onChange={e => setNewTemplateName(e.target.value)}
                                    placeholder="e.g. Accommodation Only Booking v2"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && newTemplateName.trim() && newTemplateType) {
                                            handleCreateNewTemplate();
                                        }
                                    }}
                                />
                            </div>

                            {/* Template type selection */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Template Type <span className="text-red-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">

                                    {/* Funded */}
                                    <button
                                        onClick={() => setNewTemplateType('funded')}
                                        className={`flex flex-col items-start p-4 rounded-lg border-2 text-left transition-all ${
                                            newTemplateType === 'funded'
                                                ? 'border-green-500 bg-green-50'
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                                            newTemplateType === 'funded' ? 'bg-green-100' : 'bg-gray-100'
                                        }`}>
                                            <svg
                                                className={`w-4 h-4 ${newTemplateType === 'funded' ? 'text-green-600' : 'text-gray-400'}`}
                                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <span className={`text-sm font-semibold ${newTemplateType === 'funded' ? 'text-green-700' : 'text-gray-700'}`}>
                                            Funded
                                        </span>
                                        <span className="text-xs text-gray-500 mt-0.5 leading-snug">
                                            NDIS, iCare or other funded stays
                                        </span>
                                    </button>

                                    {/* Accommodation Only */}
                                    <button
                                        onClick={() => setNewTemplateType('accommodation_only')}
                                        className={`flex flex-col items-start p-4 rounded-lg border-2 text-left transition-all ${
                                            newTemplateType === 'accommodation_only'
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                                            newTemplateType === 'accommodation_only' ? 'bg-blue-100' : 'bg-gray-100'
                                        }`}>
                                            <svg
                                                className={`w-4 h-4 ${newTemplateType === 'accommodation_only' ? 'text-blue-600' : 'text-gray-400'}`}
                                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                            </svg>
                                        </div>
                                        <span className={`text-sm font-semibold ${newTemplateType === 'accommodation_only' ? 'text-blue-700' : 'text-gray-700'}`}>
                                            Accommodation Only
                                        </span>
                                        <span className="text-xs text-gray-500 mt-0.5 leading-snug">
                                            Private-pay stays, no funding
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Validation hint */}
                            {(!newTemplateName.trim() || !newTemplateType) && (
                                <p className="text-xs text-amber-600 mb-4">
                                    {!newTemplateName.trim() && !newTemplateType
                                        ? 'Please enter a name and select a type to continue.'
                                        : !newTemplateName.trim()
                                            ? 'Please enter a template name.'
                                            : 'Please select a template type.'
                                    }
                                </p>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowNewTemplateDialog(false);
                                        setNewTemplateName('');
                                        setNewTemplateType(null);
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateNewTemplate}
                                    disabled={!newTemplateName.trim() || !newTemplateType || creatingTemplate}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {creatingTemplate ? 'Creating...' : 'Create Template'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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