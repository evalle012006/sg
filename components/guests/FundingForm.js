import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { Plus, Trash2, Edit2, AlertCircle, Calendar } from 'lucide-react';
import moment from 'moment';
import { useContext } from 'react';
import { AbilityContext, Can } from '../../services/acl/can';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const SelectComponent = dynamic(() => import('../ui/select'));
const DateComponent = dynamic(() => import('../ui-v2/DateField'));

const FundingForm = ({ uuid, onSuccess }) => {
  const ability = useContext(AbilityContext);
  const [loading, setLoading] = useState(false);
  const [fundingApprovals, setFundingApprovals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingApproval, setEditingApproval] = useState(null);
  // modalType: null (type selection step) | 'primary' | 'additional_room'
  const [modalType, setModalType] = useState(null);

  // Package and Room Type options
  const [packageOptions, setPackageOptions] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [roomTypeOptions, setRoomTypeOptions] = useState([]);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);

  useEffect(() => {
    if (uuid) {
      fetchFundingApprovals();
      loadPackageOptions();
      loadRoomTypes();
    }
  }, [uuid]);

  const fetchFundingApprovals = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/guests/${uuid}/funding-approvals`);
      if (response.ok) {
        const result = await response.json();
        setFundingApprovals(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching funding approvals:', error);
      toast.error('Failed to load funding approvals');
    } finally {
      setLoading(false);
    }
  };

  const loadPackageOptions = async () => {
    setLoadingPackages(true);
    try {
      const response = await fetch('/api/packages/?funder=Non-NDIS&limit=100');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const result = await response.json();
      const packageList = [];
      const responseData = result.packages || result;
      
      if (Array.isArray(responseData)) {
        responseData.forEach(pkg => {
          if (pkg.funder === 'Non-NDIS') {
            packageList.push({
              label: pkg.name + (pkg.package_code ? ` (${pkg.package_code})` : ''),
              value: pkg.id,
              packageData: pkg
            });
          }
        });
      }
      
      packageList.sort((a, b) => a.label.localeCompare(b.label));
      setPackageOptions(packageList);
    } catch (error) {
      console.error('Error loading packages:', error);
      toast.error('Failed to load package options');
    } finally {
      setLoadingPackages(false);
    }
  };

  const loadRoomTypes = async () => {
    setLoadingRoomTypes(true);
    try {
      const response = await fetch('/api/manage-room?simple=true');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const result = await response.json();
      const roomTypeList = [];
      
      if (Array.isArray(result)) {
        result.forEach(roomType => {
          roomTypeList.push({
            label: roomType.name,
            value: roomType.id,
            roomTypeData: roomType
          });
        });
      }
      
      roomTypeList.sort((a, b) => a.label.localeCompare(b.label));
      setRoomTypeOptions(roomTypeList);
    } catch (error) {
      console.error('Error loading room types:', error);
      toast.error('Failed to load room types');
    } finally {
      setLoadingRoomTypes(false);
    }
  };

  // ─── Open handlers ──────────────────────────────────────────────────────────

  const handleAddNew = () => {
    setEditingApproval(null);
    setModalType(null); // null = type selection step
    setShowModal(true);
  };

  const handleEdit = (approval) => {
    setEditingApproval(approval);
    // Determine type from the record itself
    setModalType(
      (!!approval.additional_room_type_id ||
       approval.additional_room_nights_approved != null ||
       approval.additional_room_nights_used != null)
        ? 'additional_room'
        : 'primary'
    );
    setShowModal(true);
  };

  const handleDelete = async (approvalId) => {
    if (!confirm('Are you sure you want to delete this funding approval?')) return;

    try {
      const response = await fetch(`/api/guests/${uuid}/funding-approvals/${approvalId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Funding approval deleted successfully');
        fetchFundingApprovals();
      } else {
        throw new Error('Failed to delete approval');
      }
    } catch (error) {
      console.error('Error deleting approval:', error);
      toast.error('Failed to delete funding approval');
    }
  };

  // ─── Totals — primary approvals only ────────────────────────────────────────

  const calculateTotals = () => {
    return fundingApprovals.reduce((totals, approval) => {
      // Skip additional room approvals from the main totals
      if (
        approval.additional_room_type_id ||
        approval.additional_room_nights_approved != null ||
        approval.additional_room_nights_used != null
      ) return totals;

      // Skip expired approvals from totals
      const isExpired = approval.approval_to && moment(approval.approval_to).isBefore(moment());
      if (isExpired) return totals;

      const nightsApproved = approval.nights_approved || 0;
      const nightsUsed = approval.nights_used || 0;
      const nightsRemaining = Math.max(0, nightsApproved - nightsUsed);

      return {
        totalAllocated: totals.totalAllocated + nightsApproved,
        totalUsed: totals.totalUsed + nightsUsed,
        totalRemaining: totals.totalRemaining + nightsRemaining
      };
    }, { totalAllocated: 0, totalUsed: 0, totalRemaining: 0 });
  };

  // ─── Sort helpers ────────────────────────────────────────────────────────────

  const sortApprovals = (list) =>
    [...list].sort((a, b) => {
      const aExpired = a.approval_to && moment(a.approval_to).isBefore(moment());
      const bExpired = b.approval_to && moment(b.approval_to).isBefore(moment());
      if (aExpired && !bExpired) return 1;
      if (!aExpired && bExpired) return -1;
      return moment(a.approval_from).diff(moment(b.approval_from));
    });

  // An approval is treated as "additional room" if it has a room type set OR has additional room nights
  // (room type may be null if admin skipped that field)
  const isAdditionalRoomApproval = (a) =>
    !!a.additional_room_type_id ||
    a.additional_room_nights_approved != null ||
    a.additional_room_nights_used != null;

  const sortedApprovals = sortApprovals(fundingApprovals);

  const totals = calculateTotals();

  // ─── Approval Cards ──────────────────────────────────────────────────────────

  const ApprovalCard = ({ approval }) => {
    const nightsApproved = approval.nights_approved || 0;
    const nightsUsed = approval.nights_used || 0;
    const nightsRemaining = Math.max(0, nightsApproved - nightsUsed);
    const nightsPercentage = nightsApproved > 0 ? (nightsUsed / nightsApproved) * 100 : 0;

    const isExpired = approval.approval_to && moment(approval.approval_to).isBefore(moment());
    const isActive = approval.approval_from && approval.approval_to
      ? moment().isBetween(moment(approval.approval_from), moment(approval.approval_to), 'day', '[]')
      : false;

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Card Header */}
        <div className={`p-4 border-b border-gray-200 ${isActive ? 'bg-blue-50' : 'bg-gray-50'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-gray-800">
                  {approval.approval_name}
                </h3>
                {isActive && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded">
                    Active
                  </span>
                )}
                {isExpired && (
                  <span className="px-2 py-0.5 bg-red-400 text-white text-xs font-medium rounded">
                    Expired
                  </span>
                )}
              </div>
              {approval.approval_number && (
                <p className="text-xs text-gray-500">
                  Approval number: {approval.approval_number}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                <Calendar size={13} className="flex-shrink-0" />
                <span>
                  {moment(approval.approval_from).format('DD MMM YYYY')} – {moment(approval.approval_to).format('DD MMM YYYY')}
                </span>
              </div>
            </div>

            {/* In ApprovalCard */}
            <div className="flex items-center gap-2">
                {ability.can('Create/Edit', 'Approval') && (
                    <button
                        onClick={() => handleEdit(approval)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                    >
                        <Edit2 size={16} />
                    </button>
                )}
                {ability.can('Create/Edit', 'Approval') && (
                    <button
                        onClick={() => handleDelete(approval.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">iCare Package Funding</h4>

              {approval.package && (
                <div className="mb-3 pb-3 border-b border-gray-200">
                  <p className="text-xs text-gray-500 mb-1">Package approved</p>
                  <p className="text-sm text-gray-800">
                    {approval.package.name}
                    {approval.package.package_code && ` (${approval.package.package_code})`}
                  </p>
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nights approved</span>
                  <span className="font-medium text-gray-800">{nightsApproved}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nights used</span>
                  <span className="font-medium text-gray-800">{nightsUsed}</span>
                </div>
              </div>
            </div>

            {/* Right Column - Tracker */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">iCare Night Tracker</h4>
              <p className="text-xs text-gray-600 mb-4">Number of nights used in service approval period</p>

              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-gray-800 mb-2">
                  {nightsUsed} of {nightsApproved}
                </div>

                {nightsApproved > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        nightsPercentage >= 100 ? 'bg-red-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(100, nightsPercentage)}%` }}
                    />
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  {nightsApproved > 0
                    ? nightsRemaining > 0
                      ? `${nightsRemaining} nights remaining`
                      : 'No nights remaining'
                    : 'Set approval period and nights to track usage'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AdditionalRoomCard = ({ approval }) => {
    const nightsApproved = approval.additional_room_nights_approved ?? 0;
    const nightsUsed = approval.additional_room_nights_used ?? 0;
    const nightsRemaining = Math.max(0, nightsApproved - nightsUsed);
    const nightsPercentage = nightsApproved > 0 ? (nightsUsed / nightsApproved) * 100 : 0;

    const isExpired = approval.approval_to && moment(approval.approval_to).isBefore(moment());
    const isActive = approval.approval_from && approval.approval_to
      ? moment().isBetween(moment(approval.approval_from), moment(approval.approval_to), 'day', '[]')
      : false;

    return (
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #d8b4fe', borderLeft: '4px solid #9333ea' }}>
        {/* Card Header */}
        <div className={`p-4 border-b border-purple-200 ${isActive ? 'bg-purple-50' : 'bg-gray-50'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {/* Room icon */}
                <svg className="w-4 h-4 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3 className="text-base font-semibold text-gray-800">
                  {approval.approval_name}
                </h3>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                  Additional Room
                </span>
                {isActive && (
                  <span className="px-2 py-0.5 text-white text-xs font-medium rounded" style={{ background: '#9333ea' }}>
                    Active
                  </span>
                )}
                {isExpired && (
                  <span className="px-2 py-0.5 bg-red-400 text-white text-xs font-medium rounded">
                    Expired
                  </span>
                )}
              </div>
              {approval.approval_number && (
                <p className="text-xs text-gray-500 ml-6">
                  Approval number: {approval.approval_number}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-600 ml-6">
                <Calendar size={13} className="flex-shrink-0" />
                <span>
                  {moment(approval.approval_from).format('DD MMM YYYY')} – {moment(approval.approval_to).format('DD MMM YYYY')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {ability.can('Create/Edit', 'Approval') && (
                <button
                  onClick={() => handleEdit(approval)}
                  className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
              )}
              {ability.can('Create/Edit', 'Approval') && (
                <button
                  onClick={() => handleDelete(approval.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold" style={{ color: '#7e22ce' }}>Additional Room Details</h4>

              {approval.additionalRoomType && (
                <div className="mb-3 pb-3 border-b border-purple-100">
                  <p className="text-xs text-gray-500 mb-1">Room type approved</p>
                  <p className="text-sm text-gray-800">{approval.additionalRoomType.name}</p>
                </div>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-gray-600">Nights approved</span>
                  <span className="font-semibold text-gray-800">{nightsApproved}</span>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-gray-600">Nights used</span>
                  <span className="font-semibold text-gray-800">{nightsUsed}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg" style={{ background: '#fef9c3', border: '1px solid #fde68a' }}>
                <p className="text-xs" style={{ color: '#92400e' }}>
                  <span className="font-semibold">Manually managed</span> — nights are not auto-updated when bookings are confirmed.
                </p>
              </div>
            </div>

            {/* Right Column - Tracker */}
            <div>
              <h4 className="text-sm font-semibold mb-3" style={{ color: '#7e22ce' }}>Additional Room Tracker</h4>
              <p className="text-xs text-gray-500 mb-4">Manually managed — adjust used nights directly on this record</p>

              <div className="rounded-lg p-6 text-center" style={{ background: '#faf5ff' }}>
                <div className="text-3xl font-bold text-gray-800 mb-2">
                  {nightsUsed} of {nightsApproved}
                </div>

                {nightsApproved > 0 && (
                  <div className="w-full bg-purple-100 rounded-full h-3 mb-4">
                    <div
                      className="h-3 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, nightsPercentage)}%`,
                        background: nightsPercentage >= 100 ? '#dc2626' : '#9333ea'
                      }}
                    />
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  {nightsApproved > 0
                    ? nightsRemaining > 0
                      ? `${nightsRemaining} nights remaining`
                      : 'No nights remaining'
                    : 'Set nights approved to track usage'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Modal ───────────────────────────────────────────────────────────────────

  const ApprovalFormModal = () => {
    const isAdditionalRoom = modalType === 'additional_room';

    const [formData, setFormData] = useState({
      approval_name: '',
      approval_number: '',
      nights_approved: '',
      nights_used: '',
      package_id: null,
      approval_from: '',
      approval_to: '',
      // Additional room fields (only used when modalType === 'additional_room')
      additional_room_type_id: null,
      additional_room_nights_approved: '',
      additional_room_nights_used: '',
      status: 'active',
      notes: ''
    });

    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (editingApproval) {
        setFormData({
          approval_name: editingApproval.approval_name || '',
          approval_number: editingApproval.approval_number || '',
          nights_approved: editingApproval.nights_approved ?? '',
          nights_used: editingApproval.nights_used ?? '',
          package_id: editingApproval.package_id || null,
          approval_from: editingApproval.approval_from || '',
          approval_to: editingApproval.approval_to || '',
          additional_room_type_id: editingApproval.additional_room_type_id || null,
          additional_room_nights_approved: editingApproval.additional_room_nights_approved ?? '',
          additional_room_nights_used: editingApproval.additional_room_nights_used ?? '',
          status: editingApproval.status || 'active',
          notes: editingApproval.notes || ''
        });
      } else {
        setFormData({
          approval_name: '',
          approval_number: '',
          nights_approved: '',
          nights_used: '',
          package_id: null,
          approval_from: '',
          approval_to: '',
          additional_room_type_id: null,
          additional_room_nights_approved: '',
          additional_room_nights_used: '',
          status: 'active',
          notes: ''
        });
      }
    }, [editingApproval]);

    // If no type selected yet and not editing, show the type selection step
    if (!editingApproval && modalType === null) {
      return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full flex flex-col my-4 sm:my-8">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Add Funding Approval</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">Select the type of approval to add</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <span className="text-2xl text-gray-500">×</span>
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setModalType('primary')}
                className="flex flex-col items-start p-5 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="w-10 h-10 bg-blue-100 group-hover:bg-blue-200 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">Package Approval</h3>
                <p className="text-xs text-gray-500">Standard iCare package funding. Nights are automatically tracked when bookings are confirmed.</p>
              </button>

              <button
                onClick={() => setModalType('additional_room')}
                className="flex flex-col items-start p-5 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
              >
                <div className="w-10 h-10 bg-purple-100 group-hover:bg-purple-200 rounded-lg flex items-center justify-center mb-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">Additional Room Approval</h3>
                <p className="text-xs text-gray-500">Separate approval for an additional room. Nights are managed manually by admin.</p>
              </button>
            </div>
          </div>
        </div>
      );
    }

    const getSelectedPackageLabel = () => {
      if (formData.package_id && packageOptions.length > 0) {
        const selectedOption = packageOptions.find(option => option.value === formData.package_id);
        return selectedOption ? selectedOption.label : '';
      }
      return '';
    };

    const getSelectedRoomTypeLabel = () => {
      if (formData.additional_room_type_id && roomTypeOptions.length > 0) {
        const selectedOption = roomTypeOptions.find(option => option.value === formData.additional_room_type_id);
        return selectedOption ? selectedOption.label : '';
      }
      return '';
    };

    const validateForm = () => {
      if (formData.approval_from && formData.approval_to) {
        const fromDate = moment(formData.approval_from);
        const toDate = moment(formData.approval_to);
        if (toDate.isBefore(fromDate)) {
          toast.error('Approval end date must be after start date');
          return false;
        }
      }

      return true;
    };

    const handleSave = async () => {
      if (!validateForm()) return;

      setSaving(true);
      try {
        const url = editingApproval
          ? `/api/guests/${uuid}/funding-approvals/${editingApproval.id}`
          : `/api/guests/${uuid}/funding-approvals`;

        const method = editingApproval ? 'PUT' : 'POST';

        const payload = {
          approval_name: formData.approval_name || null,
          approval_number: formData.approval_number || null,
          package_id: !isAdditionalRoom ? (formData.package_id || null) : null,
          approval_from: formData.approval_from || null,
          approval_to: formData.approval_to || null,
          status: formData.status || 'active',
          notes: formData.notes || null,
          ...(isAdditionalRoom
            ? {
                // Additional room approval — primary nights fields are null
                nights_approved: null,
                nights_used: null,
                additional_room_type_id: formData.additional_room_type_id || null,
                additional_room_nights_approved: formData.additional_room_nights_approved !== ''
                  ? parseInt(formData.additional_room_nights_approved)
                  : null,
                additional_room_nights_used: formData.additional_room_nights_used !== ''
                  ? parseInt(formData.additional_room_nights_used)
                  : null,
              }
            : {
                // Primary approval — additional room fields are null
                nights_approved: formData.nights_approved !== '' ? parseInt(formData.nights_approved) : null,
                nights_used: formData.nights_used !== '' ? parseInt(formData.nights_used) : null,
                additional_room_type_id: null,
                additional_room_nights_approved: null,
                additional_room_nights_used: null,
              }
          )
        };

        const response = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          toast.success(editingApproval ? 'Funding approval updated successfully!' : 'Funding approval created successfully!');
          setShowModal(false);
          fetchFundingApprovals();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to save funding approval');
        }
      } catch (error) {
        console.error('Error saving funding approval:', error);
        toast.error(error.message || 'Failed to save funding approval. Please try again.');
      } finally {
        setSaving(false);
      }
    };

    const accentColor = isAdditionalRoom ? 'bg-purple-600' : 'bg-blue-600';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
        <div className="bg-white rounded-lg max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col my-4 sm:my-8">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                  {editingApproval
                    ? `Edit ${isAdditionalRoom ? 'Additional Room ' : ''}Funding Approval`
                    : `Add ${isAdditionalRoom ? 'Additional Room ' : 'New '}Funding Approval`}
                </h2>
                {isAdditionalRoom && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded border border-purple-200">
                    Additional Room
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500">
                {isAdditionalRoom
                  ? 'Additional room approvals are manually managed — nights will not auto-update from bookings'
                  : 'Create a new funding approval for this guest'
                }
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!editingApproval && (
                <button
                  onClick={() => setModalType(null)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={saving}
                  title="Back to type selection"
                >
                  <span className="text-base">‹</span> Back
                </button>
              )}
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                disabled={saving}
              >
                <span className="text-2xl text-gray-500">×</span>
              </button>
            </div>
          </div>

          {/* Modal Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 space-y-6 sm:space-y-8">

              {/* Basic Information */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-1 h-5 ${accentColor} rounded-full`}></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Basic Information</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <TextField
                    label="Approval name"
                    value={formData.approval_name}
                    onChange={(value) => setFormData(prev => ({ ...prev, approval_name: value }))}
                    placeholder="e.g., iCare Winter 2024"
                  />
                  <TextField
                    label="Approval number"
                    value={formData.approval_number}
                    onChange={(value) => setFormData(prev => ({ ...prev, approval_number: value }))}
                    placeholder="Enter approval reference number"
                  />
                </div>
              </div>

              {/* Approval Period */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-1 h-5 ${accentColor} rounded-full`}></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Approval Period</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <DateComponent
                    label="Start date"
                    value={formData.approval_from}
                    onChange={(value) => setFormData(prev => ({ ...prev, approval_from: value }))}
                  />
                  <DateComponent
                    label="End date"
                    value={formData.approval_to}
                    onChange={(value) => setFormData(prev => ({ ...prev, approval_to: value }))}
                  />
                </div>
                {formData.approval_from && formData.approval_to && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs sm:text-sm text-blue-700">
                      <span className="font-medium">Duration:</span> {moment(formData.approval_to).diff(moment(formData.approval_from), 'days') + 1} days
                    </p>
                  </div>
                )}
              </div>

              {/* Conditional: Primary vs Additional Room fields */}
              {!isAdditionalRoom ? (
                /* iCare Package Funding */
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-1 h-5 ${accentColor} rounded-full`}></div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800">iCare Package Funding</h3>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">
                        Package approved
                        {loadingPackages && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
                      </label>
                      <SelectComponent
                        options={packageOptions}
                        value={getSelectedPackageLabel()}
                        onChange={(selected) => setFormData(prev => ({ ...prev, package_id: selected?.value || null }))}
                        placeholder={loadingPackages ? 'Loading packages...' : 'Select package type'}
                        disabled={loadingPackages}
                        isClearable={true}
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Select the iCare package associated with this approval</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <TextField
                          label="Nights approved"
                          type="number"
                          value={formData.nights_approved}
                          onChange={(value) => setFormData(prev => ({ ...prev, nights_approved: value }))}
                          placeholder="0"
                          min="0"
                        />
                        <p className="text-xs text-gray-500 mt-1.5">Total nights allocated in this approval</p>
                      </div>
                      <div>
                        <TextField
                          label="Nights used"
                          type="number"
                          value={formData.nights_used}
                          onChange={(value) => setFormData(prev => ({ ...prev, nights_used: value }))}
                          placeholder="0"
                          min="0"
                        />
                        <p className="text-xs text-gray-500 mt-1.5">Nights already consumed from this approval</p>
                      </div>
                    </div>

                    {formData.nights_approved && (
                      <div className="p-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Remaining nights:</span>
                          <span className="font-semibold text-gray-800">
                            {Math.max(0, parseInt(formData.nights_approved || 0) - parseInt(formData.nights_used || 0))} nights
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Additional Room Funding */
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className={`w-1 h-5 ${accentColor} rounded-full`}></div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800">Additional Room Details</h3>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 sm:p-5 space-y-4">
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-700">
                        <span className="font-medium">Manually managed:</span> This approval will not be auto-updated when bookings are confirmed. Admin must adjust &quot;Nights used&quot; manually.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700">
                        Room type approved
                        {loadingRoomTypes && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
                      </label>
                      <SelectComponent
                        options={roomTypeOptions}
                        value={getSelectedRoomTypeLabel()}
                        onChange={(selected) => setFormData(prev => ({ ...prev, additional_room_type_id: selected?.value || null }))}
                        placeholder={loadingRoomTypes ? 'Loading room types...' : 'Select room type'}
                        disabled={loadingRoomTypes}
                        isClearable={false}
                      />
                      <p className="text-xs text-gray-500 mt-1.5">The type of additional room covered by this approval</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <TextField
                          label="Nights approved"
                          type="number"
                          value={formData.additional_room_nights_approved}
                          onChange={(value) => setFormData(prev => ({ ...prev, additional_room_nights_approved: value }))}
                          placeholder="0"
                          min="0"
                        />
                        <p className="text-xs text-gray-500 mt-1.5">Total additional room nights allocated</p>
                      </div>
                      <div>
                        <TextField
                          label="Nights used"
                          type="number"
                          value={formData.additional_room_nights_used}
                          onChange={(value) => setFormData(prev => ({ ...prev, additional_room_nights_used: value }))}
                          placeholder="0"
                          min="0"
                        />
                        <p className="text-xs text-gray-500 mt-1.5">Adjust manually as nights are consumed</p>
                      </div>
                    </div>

                    {formData.additional_room_nights_approved && (
                      <div className="p-3 bg-white border border-purple-200 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Remaining nights:</span>
                          <span className="font-semibold text-gray-800">
                            {Math.max(0, parseInt(formData.additional_room_nights_approved || 0) - parseInt(formData.additional_room_nights_used || 0))} nights
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-gray-400 rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Additional Notes</h3>
                </div>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any additional notes, special conditions, or important details about this approval..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <Button
              onClick={() => setShowModal(false)}
              disabled={saving}
              size="medium"
              color="secondary"
              label="Cancel"
            />
            <Button
              onClick={handleSave}
              disabled={saving}
              size="medium"
              color="primary"
              label={saving ? 'Saving...' : (editingApproval ? 'Update Approval' : 'Create Approval')}
              withIcon={true}
              iconName="check"
            />
          </div>
        </div>
      </div>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Funding Approvals</h2>
          <p className="text-sm text-gray-600">
            Track and manage funding approvals for this guest
          </p>
        </div>
        {ability.can('Create/Edit', 'Approval') && (
            <Button
                onClick={handleAddNew}
                size="medium"
                color="primary"
                label="Add Approval"
                withIcon={true}
                iconName="plus"
                Icon={Plus}
            />
        )}
      </div>

      {/* Summary Cards — primary approvals only */}
      {fundingApprovals.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total allocated</p>
            <p className="text-2xl font-bold text-gray-800">{totals.totalAllocated}</p>
            <p className="text-xs text-gray-500">nights (active approvals only)</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total used</p>
            <p className="text-2xl font-bold text-gray-800">{totals.totalUsed}</p>
            <p className="text-xs text-gray-500">nights (active approvals only)</p>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How funding approvals work:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Funding approvals track allocated nights vs. nights used</li>
              <li>Nights are automatically deducted when iCare bookings are confirmed</li>
              <li>Additional room approvals are managed separately and not auto-updated</li>
              <li>Active approvals are highlighted (within date range); expired approvals excluded from totals</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Primary Approvals */}
      {fundingApprovals.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Funding Approvals Yet</h3>
          <p className="text-gray-600 mb-6">
            Create funding approvals for this guest to start tracking night usage
          </p>
          {ability.can('Create/Edit', 'Approval') && (
            <Button
                onClick={handleAddNew}
                size="medium"
                color="primary"
                label="Add First Approval"
                withIcon={true}
                iconName="plus"
                Icon={Plus}
            />
        )}
        </div>
      ) : (
        <div className="space-y-6">
          {sortedApprovals.map((approval) =>
            isAdditionalRoomApproval(approval)
              ? <AdditionalRoomCard key={approval.id} approval={approval} />
              : <ApprovalCard key={approval.id} approval={approval} />
          )}
        </div>
      )}

      {showModal && <ApprovalFormModal />}
    </div>
  );
};

export default FundingForm;