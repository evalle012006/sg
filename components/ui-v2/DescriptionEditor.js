import React, { useRef, useState, useCallback } from 'react';
import { List, ListOrdered, Bold, Italic, Minus, RotateCcw } from 'lucide-react';

/**
 * DescriptionEditor - A textarea with formatting toolbar for package descriptions
 * Supports bullet lists, numbered lists, and basic text formatting
 */
const DescriptionEditor = ({
    value = '',
    onChange,
    placeholder = 'Enter description...',
    maxLength = 2000,
    disabled = false,
    rows = 6,
    className = '',
    error = null,
    label = 'Description',
    required = false,
    showCharCount = true,
    id = 'description'
}) => {
    const textareaRef = useRef(null);
    const [selectionStart, setSelectionStart] = useState(0);
    const [selectionEnd, setSelectionEnd] = useState(0);

    // Track selection for inserting formatting
    const handleSelect = useCallback(() => {
        if (textareaRef.current) {
            setSelectionStart(textareaRef.current.selectionStart);
            setSelectionEnd(textareaRef.current.selectionEnd);
        }
    }, []);

    // Insert text at cursor position
    const insertAtCursor = useCallback((textBefore, textAfter = '') => {
        const textarea = textareaRef.current;
        if (!textarea || disabled) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = value || '';
        const selectedText = currentValue.substring(start, end);
        
        const newValue = 
            currentValue.substring(0, start) + 
            textBefore + 
            selectedText + 
            textAfter + 
            currentValue.substring(end);

        onChange({ target: { name: id, value: newValue } });

        // Restore cursor position after update
        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + textBefore.length + selectedText.length + textAfter.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
    }, [value, onChange, disabled, id]);

    // Insert bullet point at beginning of current line or new line
    const insertBullet = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea || disabled) return;

        const start = textarea.selectionStart;
        const currentValue = value || '';
        
        // Find the beginning of the current line
        let lineStart = start;
        while (lineStart > 0 && currentValue[lineStart - 1] !== '\n') {
            lineStart--;
        }

        // Check if current line already has a bullet
        const currentLinePrefix = currentValue.substring(lineStart, lineStart + 2);
        if (currentLinePrefix === '- ' || currentLinePrefix === '• ') {
            return; // Already a bullet point
        }

        // If at end of text or after newline, insert bullet on new line
        if (start === currentValue.length || currentValue[start - 1] === '\n' || start === 0) {
            const prefix = start > 0 && currentValue[start - 1] !== '\n' ? '\n' : '';
            insertAtCursor(prefix + '- ');
        } else {
            // Insert bullet at beginning of current line
            const newValue = 
                currentValue.substring(0, lineStart) + 
                '- ' + 
                currentValue.substring(lineStart);
            onChange({ target: { name: id, value: newValue } });
            
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + 2, start + 2);
            }, 0);
        }
    }, [value, onChange, disabled, insertAtCursor, id]);

    // Insert numbered list item
    const insertNumberedItem = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea || disabled) return;

        const start = textarea.selectionStart;
        const currentValue = value || '';
        
        // Find what number to use by counting previous numbered items
        const textBefore = currentValue.substring(0, start);
        const lines = textBefore.split('\n');
        let lastNumber = 0;
        
        // Find the last numbered item
        for (let i = lines.length - 1; i >= 0; i--) {
            const match = lines[i].match(/^(\d+)\.\s/);
            if (match) {
                lastNumber = parseInt(match[1], 10);
                break;
            }
        }

        const nextNumber = lastNumber + 1;
        const prefix = start > 0 && currentValue[start - 1] !== '\n' ? '\n' : '';
        insertAtCursor(prefix + `${nextNumber}. `);
    }, [value, insertAtCursor, disabled]);

    // Insert horizontal divider
    const insertDivider = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea || disabled) return;

        const start = textarea.selectionStart;
        const currentValue = value || '';
        const prefix = start > 0 && currentValue[start - 1] !== '\n' ? '\n\n' : '\n';
        insertAtCursor(prefix + '---\n');
    }, [value, insertAtCursor, disabled]);

    // Clear formatting from selection
    const clearFormatting = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea || disabled) return;

        const currentValue = value || '';
        // Remove common formatting patterns
        let cleaned = currentValue
            .replace(/^[-•]\s+/gm, '')  // Remove bullet points
            .replace(/^\d+\.\s+/gm, '') // Remove numbered items
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1'); // Remove italic
        
        onChange({ target: { name: id, value: cleaned } });
    }, [value, onChange, disabled, id]);

    // Handle tab key for indentation
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            insertAtCursor('    '); // 4 spaces for indentation
        }
        // Handle Enter key to continue list formatting
        if (e.key === 'Enter') {
            const textarea = textareaRef.current;
            const start = textarea.selectionStart;
            const currentValue = value || '';
            
            // Find the beginning of the current line
            let lineStart = start;
            while (lineStart > 0 && currentValue[lineStart - 1] !== '\n') {
                lineStart--;
            }
            
            const currentLine = currentValue.substring(lineStart, start);
            
            // Check for bullet point
            if (currentLine.match(/^[-•]\s+\S/)) {
                e.preventDefault();
                insertAtCursor('\n- ');
                return;
            }
            
            // Check for numbered list
            const numberMatch = currentLine.match(/^(\d+)\.\s+\S/);
            if (numberMatch) {
                e.preventDefault();
                const nextNum = parseInt(numberMatch[1], 10) + 1;
                insertAtCursor(`\n${nextNum}. `);
                return;
            }
            
            // Check for empty list item (remove the marker)
            if (currentLine.match(/^[-•]\s*$/) || currentLine.match(/^\d+\.\s*$/)) {
                e.preventDefault();
                const newValue = currentValue.substring(0, lineStart) + currentValue.substring(start);
                onChange({ target: { name: id, value: newValue } });
                setTimeout(() => {
                    textarea.focus();
                    textarea.setSelectionRange(lineStart, lineStart);
                }, 0);
                return;
            }
        }
    }, [value, onChange, insertAtCursor, id]);

    const charCount = (value || '').length;
    const isOverLimit = maxLength && charCount > maxLength;

    return (
        <div className={`description-editor ${className}`}>
            {/* Label */}
            {label && (
                <label 
                    htmlFor={id} 
                    className="block text-sm font-medium text-gray-700 mb-2"
                >
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            {/* Toolbar */}
            <div className={`
                flex items-center gap-1 p-2 bg-gray-50 border border-b-0 rounded-t-md
                ${disabled ? 'opacity-50 pointer-events-none' : ''}
                ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'}
            `}>
                <div className="flex items-center gap-1">
                    {/* Bullet List */}
                    <button
                        type="button"
                        onClick={insertBullet}
                        className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                        title="Bullet List (- )"
                        disabled={disabled}
                    >
                        <List className="w-4 h-4 text-gray-600" />
                    </button>

                    {/* Numbered List */}
                    <button
                        type="button"
                        onClick={insertNumberedItem}
                        className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                        title="Numbered List (1. )"
                        disabled={disabled}
                    >
                        <ListOrdered className="w-4 h-4 text-gray-600" />
                    </button>

                    <div className="w-px h-5 bg-gray-300 mx-1" />

                    {/* Divider */}
                    <button
                        type="button"
                        onClick={insertDivider}
                        className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                        title="Insert Divider (---)"
                        disabled={disabled}
                    >
                        <Minus className="w-4 h-4 text-gray-600" />
                    </button>

                    {/* Clear Formatting */}
                    <button
                        type="button"
                        onClick={clearFormatting}
                        className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                        title="Clear Formatting"
                        disabled={disabled}
                    >
                        <RotateCcw className="w-4 h-4 text-gray-600" />
                    </button>
                </div>

                {/* Formatting hints */}
                <div className="ml-auto text-xs text-gray-500 hidden sm:block">
                    <span className="mr-3">Use <code className="bg-gray-200 px-1 rounded">-</code> for bullets</span>
                    <span>Use <code className="bg-gray-200 px-1 rounded">1.</code> for numbered lists</span>
                </div>
            </div>

            {/* Textarea */}
            <textarea
                ref={textareaRef}
                id={id}
                name={id}
                value={value}
                onChange={onChange}
                onSelect={handleSelect}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={disabled}
                rows={rows}
                maxLength={maxLength || undefined}
                className={`
                    w-full px-3 py-2 border rounded-b-md resize-y
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    text-sm leading-relaxed
                    ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}
                    ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
                    ${isOverLimit ? 'border-red-400 bg-red-50' : ''}
                `}
            />

            {/* Character count and error */}
            <div className="flex justify-between items-center mt-1.5">
                {error ? (
                    <p className="text-sm text-red-600">{error}</p>
                ) : (
                    <div />
                )}
                
                {showCharCount && maxLength && (
                    <p className={`text-xs ${isOverLimit ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                        {charCount}/{maxLength} characters
                    </p>
                )}
            </div>
        </div>
    );
};

export default DescriptionEditor;