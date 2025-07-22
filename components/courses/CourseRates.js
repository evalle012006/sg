/* eslint-disable react/display-name */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { 
  Plus, 
  Trash2, 
  Save,
  GripVertical,
  Package,
  DollarSign
} from 'lucide-react';
import { toast } from 'react-toastify';

const Button = dynamic(() => import('../../components/ui-v2/Button'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));

// Debounced Input Component
const DebouncedInput = React.memo(({ value, onChange, onBlur, placeholder, type = "text", className, style }) => {
    const [localValue, setLocalValue] = useState(value);
    const timeoutRef = useRef(null);

    // Update local value when prop value changes (from external updates)
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Handle input change with debouncing
    const handleChange = (e) => {
        const newValue = e.target.value;
        setLocalValue(newValue);

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout to update parent state
        timeoutRef.current = setTimeout(() => {
            onChange(newValue);
        }, 500); // Increased to 500ms to reduce updates
    };

    // Handle blur - immediate update
    const handleBlur = (e) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        onChange(localValue);
        if (onBlur) onBlur(e);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
        <input
            type={type}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={className}
            style={style}
            step={type === "number" ? "0.01" : undefined}
            min={type === "number" ? "0" : undefined}
        />
    );
});

export default function CourseRates() {
    const [courseRates, setCourseRates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Use state for hasChanges instead of ref + forceUpdate
    const [hasChanges, setHasChanges] = useState(false);
    const originalRatesRef = useRef([]);

    const dayTypeOptions = [
        { value: 'weekday', label: 'Weekday' },
        { value: 'saturday', label: 'Saturday' }
    ];

    useEffect(() => {
        loadCourseRates();
    }, []);

    const loadCourseRates = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/courses/rates');
            if (!response.ok) {
                throw new Error('Failed to load course rates');
            }
            
            const result = await response.json();
            const ratesData = result.data || [];
            
            // Sort by category, day_type, and then by order
            const sortedRates = ratesData.sort((a, b) => {
                if (a.category !== b.category) {
                    return a.category === 'holiday' ? -1 : 1;
                }
                if (a.day_type !== b.day_type) {
                    const dayOrder = ['weekday', 'saturday', 'sunday', 'public_holiday'];
                    return dayOrder.indexOf(a.day_type) - dayOrder.indexOf(b.day_type);
                }
                return a.order - b.order;
            });
            
            setCourseRates(sortedRates);
            // Store original rates for comparison
            originalRatesRef.current = JSON.parse(JSON.stringify(sortedRates));
            setHasChanges(false);
        } catch (error) {
            console.error('Error loading course rates:', error);
            toast.error('Failed to load course rates');
        }
        setIsLoading(false);
    };

    // Function to check if there are actual changes
    const checkForChanges = useCallback((currentRates) => {
        const currentRatesString = JSON.stringify(currentRates.map(rate => ({
            id: rate.id,
            category: rate.category,
            day_type: rate.day_type,
            package_name: rate.package_name,
            rate: rate.rate,
            order: rate.order
        })));
        
        const originalRatesString = JSON.stringify(originalRatesRef.current.map(rate => ({
            id: rate.id,
            category: rate.category,
            day_type: rate.day_type,
            package_name: rate.package_name,
            rate: rate.rate,
            order: rate.order
        })));

        return currentRatesString !== originalRatesString;
    }, []);

    // Debounced change detection to prevent frequent updates
    const checkChangesTimeoutRef = useRef(null);
    useEffect(() => {
        if (checkChangesTimeoutRef.current) {
            clearTimeout(checkChangesTimeoutRef.current);
        }
        
        checkChangesTimeoutRef.current = setTimeout(() => {
            const newHasChanges = checkForChanges(courseRates);
            if (newHasChanges !== hasChanges) {
                setHasChanges(newHasChanges);
            }
        }, 1000); // Longer delay to reduce frequent checks

        return () => {
            if (checkChangesTimeoutRef.current) {
                clearTimeout(checkChangesTimeoutRef.current);
            }
        };
    }, [courseRates, hasChanges, checkForChanges]);

    // Use useCallback to prevent function recreation on every render
    const handleRateChange = useCallback((id, field, value) => {
        setCourseRates(prev => prev.map(rate => 
            rate.id === id ? { ...rate, [field]: value } : rate
        ));
    }, []);

    const handleAddRate = useCallback((category, dayType = 'weekday') => {
        const newRate = {
            id: `temp_${Date.now()}`, // Temporary ID for new rates
            category,
            day_type: dayType,
            package_name: '',
            rate: '',
            order: getNextOrder(category, dayType),
            isNew: true
        };
        
        setCourseRates(prev => {
            const updated = [...prev, newRate];
            return updated.sort((a, b) => {
                if (a.category !== b.category) {
                    return a.category === 'holiday' ? -1 : 1;
                }
                if (a.day_type !== b.day_type) {
                    const dayOrder = ['weekday', 'saturday', 'sunday', 'public_holiday'];
                    return dayOrder.indexOf(a.day_type) - dayOrder.indexOf(b.day_type);
                }
                return a.order - b.order;
            });
        });
        
        // Mark as changed immediately for add/delete operations
        setHasChanges(true);
    }, [courseRates]);

    const handleDeleteRate = useCallback((id) => {
        if (window.confirm('Are you sure you want to delete this rate?')) {
            setCourseRates(prev => prev.filter(rate => rate.id !== id));
            // Mark as changed immediately for add/delete operations
            setHasChanges(true);
        }
    }, []);

    const getNextOrder = useCallback((category, dayType) => {
        const ratesOfType = courseRates.filter(rate => rate.category === category && rate.day_type === dayType);
        return ratesOfType.length > 0 ? Math.max(...ratesOfType.map(r => r.order)) + 1 : 0;
    }, [courseRates]);

    const handleSave = async () => {
        // Validate data
        const invalidRates = courseRates.filter(rate => 
            !rate.package_name.trim() || !rate.rate || isNaN(parseFloat(rate.rate)) || parseFloat(rate.rate) < 0
        );

        if (invalidRates.length > 0) {
            toast.error('Please ensure all rates have valid package names and positive rate values');
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch('/api/courses/rates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rates: courseRates.map(rate => ({
                        id: rate.isNew ? undefined : rate.id,
                        category: rate.category,
                        day_type: rate.day_type,
                        package_name: rate.package_name.trim(),
                        rate: parseFloat(rate.rate),
                        order: rate.order
                    }))
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to save course rates');
            }

            toast.success('Course rates saved successfully');
            
            // Reload to get fresh data with proper IDs
            await loadCourseRates(); // This will reset hasChanges
        } catch (error) {
            console.error('Error saving course rates:', error);
            toast.error(error.message || 'Failed to save course rates');
        }
        setIsSaving(false);
    };

    const groupedRates = useMemo(() => {
        const groups = {
            holiday: courseRates.filter(rate => rate.category === 'holiday'),
            sta: courseRates.filter(rate => rate.category === 'sta')
        };
        
        // Sort each group by day_type and order
        Object.keys(groups).forEach(key => {
            groups[key] = groups[key].sort((a, b) => {
                if (a.day_type !== b.day_type) {
                    const dayOrder = ['weekday', 'saturday', 'sunday', 'public_holiday'];
                    return dayOrder.indexOf(a.day_type) - dayOrder.indexOf(b.day_type);
                }
                return a.order - b.order;
            });
        });
        
        return groups;
    }, [courseRates]);

    const moveRate = useCallback((id, direction) => {
        const rate = courseRates.find(r => r.id === id);
        if (!rate) return;

        const sameTypeRates = courseRates
            .filter(r => r.category === rate.category && r.day_type === rate.day_type)
            .sort((a, b) => a.order - b.order);
        const currentIndex = sameTypeRates.findIndex(r => r.id === id);
        
        if (direction === 'up' && currentIndex > 0) {
            const prevRate = sameTypeRates[currentIndex - 1];
            setCourseRates(prev => prev.map(r => {
                if (r.id === rate.id) return { ...r, order: prevRate.order };
                if (r.id === prevRate.id) return { ...r, order: rate.order };
                return r;
            }));
            setHasChanges(true);
        } else if (direction === 'down' && currentIndex < sameTypeRates.length - 1) {
            const nextRate = sameTypeRates[currentIndex + 1];
            setCourseRates(prev => prev.map(r => {
                if (r.id === rate.id) return { ...r, order: nextRate.order };
                if (r.id === nextRate.id) return { ...r, order: rate.order };
                return r;
            }));
            setHasChanges(true);
        }
    }, [courseRates]);

    // Create a stable RateInput component to prevent re-rendering
    const RateInput = React.memo(({ rate, index, dayTypeRatesLength, onRateChange, onMoveRate, onDeleteRate }) => (
        <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex flex-col space-y-1">
                <button
                    onClick={() => onMoveRate(rate.id, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                    type="button"
                >
                    ▲
                </button>
                <GripVertical className="w-4 h-4 text-gray-400" />
                <button
                    onClick={() => onMoveRate(rate.id, 'down')}
                    disabled={index === dayTypeRatesLength - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                    type="button"
                >
                    ▼
                </button>
            </div>
            
            <div className="flex-1">
                <DebouncedInput
                    value={rate.package_name || ''}
                    onChange={(value) => onRateChange(rate.id, 'package_name', value)}
                    placeholder="Package Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
            
            <div className="w-32">
                <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <DebouncedInput
                        type="number"
                        value={rate.rate || ''}
                        onChange={(value) => onRateChange(rate.id, 'rate', value)}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>
            
            <button
                onClick={() => onDeleteRate(rate.id)}
                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                title="Delete rate"
                type="button"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    ));

    const RateGroup = React.memo(({ title, category, rates, bgColor, iconColor }) => {
        const [selectedDayType, setSelectedDayType] = useState('weekday');
        
        // Group rates by day type
        const ratesByDayType = useMemo(() => {
            return rates.reduce((groups, rate) => {
                if (!groups[rate.day_type]) {
                    groups[rate.day_type] = [];
                }
                groups[rate.day_type].push(rate);
                return groups;
            }, {});
        }, [rates]);

        return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className={`${bgColor} px-6 py-4 border-b border-gray-200`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${iconColor}`}>
                                {category === 'holiday' ? <Package className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                                <p className="text-sm text-gray-600">{rates.length} rate(s)</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <select
                                value={selectedDayType}
                                onChange={(e) => setSelectedDayType(e.target.value)}
                                className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {dayTypeOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <Button
                                color="primary"
                                size="small"
                                label="+ Add Rate"
                                onClick={() => handleAddRate(category, selectedDayType)}
                                className="bg-white text-blue-600 border-blue-600 hover:bg-blue-50"
                            />
                        </div>
                    </div>
                </div>
                
                <div className="p-6">
                    {rates.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>No rates configured for {title.toLowerCase()}</p>
                            <p className="text-sm">Click &quot;Add Rate&quot; to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {dayTypeOptions.map(dayTypeOption => {
                                const dayTypeRates = ratesByDayType[dayTypeOption.value] || [];
                                if (dayTypeRates.length === 0) return null;
                                
                                return (
                                    <div key={dayTypeOption.value} className="border-b border-gray-100 pb-4 last:border-b-0">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                                            {dayTypeOption.label} Rates
                                        </h4>
                                        <div className="space-y-3">
                                            {dayTypeRates.map((rate, index) => (
                                                <RateInput
                                                    key={rate.id}
                                                    rate={rate}
                                                    index={index}
                                                    dayTypeRatesLength={dayTypeRates.length}
                                                    onRateChange={handleRateChange}
                                                    onMoveRate={moveRate}
                                                    onDeleteRate={handleDeleteRate}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    });

    if (isLoading && courseRates.length === 0) {
        return (
            <div className='h-screen flex items-center justify-center'>
                <Spinner />
            </div>
        );
    }

    return (
        <div>
            {/* Header - Fixed position to prevent layout shift */}
            <div className="flex justify-between items-center mb-6 min-h-[80px]">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Course Rates</h2>
                    <p className="text-gray-600 mt-1">Manage pricing rates for holiday packages and STA services</p>
                </div>
                <div className="min-w-[150px] flex justify-end">
                    {hasChanges && (
                        <Button
                            color="primary"
                            size="medium"
                            label={isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                            onClick={handleSave}
                            disabled={isSaving}
                            icon={<Save className="w-4 h-4" />}
                            className="font-semibold"
                        />
                    )}
                </div>
            </div>

            {/* Unsaved Changes Warning - Fixed height to prevent layout shift */}
            <div className="min-h-[80px] mb-6">
                {hasChanges && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <Save className="w-5 h-5 text-orange-600" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm font-medium text-orange-800">
                                    You have unsaved changes
                                </p>
                                <p className="text-sm text-orange-700">
                                    Changes are automatically detected as you type. Don&apos;t forget to save before leaving.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Rate Groups */}
            <div className="space-y-8">
                <RateGroup
                    title="Holiday Package Rates"
                    category="holiday"
                    rates={groupedRates.holiday}
                    bgColor="bg-blue-50"
                    iconColor="bg-blue-100 text-blue-600"
                />
                
                <RateGroup
                    title="STA Service Rates"
                    category="sta"
                    rates={groupedRates.sta}
                    bgColor="bg-green-50"
                    iconColor="bg-green-100 text-green-600"
                />
            </div>
        </div>
    );
}