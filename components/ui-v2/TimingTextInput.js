import React, { useState, useEffect } from 'react';

/**
 * TimingTextInput - Structured timing text editor
 * Breaks down timing text into editable components but saves as single string
 * Example: "31 days to book" = [31] [days ▼] [to book]
 */
export default function TimingTextInput({ 
    label = "Timing Display Text",
    value = '', 
    onChange, 
    disabled = false,
    helpText,
    error,
    placeholder = "e.g., 45 days to book"
}) {
    // Parse the value string into components
    const parseValue = (str) => {
        if (!str || str.trim() === '') {
            return { number: '', unit: 'days', suffix: 'to book' };
        }

        // Match patterns like "31 days to book", "5 hours to book", "Booking closed", etc.
        const numberMatch = str.match(/^(\d+)\s+(days?|hours?)\s+(.+)$/i);
        
        if (numberMatch) {
            return {
                number: numberMatch[1],
                unit: numberMatch[2].toLowerCase().includes('hour') ? 'hours' : 'days',
                suffix: numberMatch[3]
            };
        }

        // If it doesn't match the pattern, return the full string as suffix
        return { number: '', unit: 'days', suffix: str };
    };

    const [components, setComponents] = useState(() => parseValue(value));

    // Update components when external value changes
    useEffect(() => {
        setComponents(parseValue(value));
    }, [value]);

    // Build the combined string
    const buildString = (num, unit, suf) => {
        if (!num || num === '') {
            return suf; // If no number, just return suffix
        }
        return `${num} ${unit} ${suf}`;
    };

    // Handle number change
    const handleNumberChange = (e) => {
        const num = e.target.value;
        const newComponents = { ...components, number: num };
        setComponents(newComponents);
        
        const combinedString = buildString(num, newComponents.unit, newComponents.suffix);
        onChange(combinedString);
    };

    // Handle unit change
    const handleUnitChange = (e) => {
        const unit = e.target.value;
        const newComponents = { ...components, unit };
        setComponents(newComponents);
        
        const combinedString = buildString(newComponents.number, unit, newComponents.suffix);
        onChange(combinedString);
    };

    // Handle suffix change
    const handleSuffixChange = (e) => {
        const suf = e.target.value;
        const newComponents = { ...components, suffix: suf };
        setComponents(newComponents);
        
        const combinedString = buildString(newComponents.number, newComponents.unit, suf);
        onChange(combinedString);
    };

    return (
        <div className="mb-4">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                </label>
            )}
            
            <div className="flex items-center gap-2">
                {/* Number Input */}
                <input
                    type="number"
                    value={components.number}
                    onChange={handleNumberChange}
                    disabled={disabled}
                    placeholder="0"
                    min="0"
                    className={`w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        error ? 'border-red-500' : 'border-gray-300'
                    } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />

                {/* Unit Dropdown */}
                <select
                    value={components.unit}
                    onChange={handleUnitChange}
                    disabled={disabled}
                    className={`px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        error ? 'border-red-500' : 'border-gray-300'
                    } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                >
                    <option value="days">days</option>
                    <option value="hours">hours</option>
                </select>

                {/* Suffix Input */}
                <input
                    type="text"
                    value={components.suffix}
                    onChange={handleSuffixChange}
                    disabled={disabled}
                    placeholder="to book"
                    className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        error ? 'border-red-500' : 'border-gray-300'
                    } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
            </div>

            {/* Help Text */}
            {helpText && !error && (
                <p className="text-gray-500 text-sm mt-1">{helpText}</p>
            )}

            {/* Error Message */}
            {error && (
                <p className="text-red-500 text-sm mt-1">{error}</p>
            )}

            {/* Preview */}
            <div className="mt-2 text-sm text-gray-600">
                Preview: <span className="font-medium">{buildString(components.number, components.unit, components.suffix)}</span>
            </div>
        </div>
    );
}