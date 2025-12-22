import React, { useMemo } from 'react';

/**
 * FormattedDescription - Renders plain text with formatting patterns as styled elements
 * Supports:
 * - Bullet lists (lines starting with - or •)
 * - Numbered lists (lines starting with 1., 2., etc.)
 * - Nested lists (bullets under numbered items)
 * - Section headers (lines ending with :)
 * - Horizontal dividers (---)
 * - Paragraphs
 */
const FormattedDescription = ({
    text = '',
    className = '',
    variant = 'default', // 'default', 'compact', 'card'
}) => {
    const formattedContent = useMemo(() => {
        if (!text || typeof text !== 'string') {
            return null;
        }

        const lines = text.split('\n');
        const elements = [];
        let key = 0;

        // Parse all lines into structured data first
        const parsedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Check indentation (spaces or tabs at start)
            const indentMatch = line.match(/^(\s*)/);
            const indentLevel = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;

            if (!trimmedLine) {
                parsedLines.push({ type: 'empty' });
                continue;
            }

            if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
                parsedLines.push({ type: 'divider' });
                continue;
            }

            const bulletMatch = trimmedLine.match(/^[-•*]\s+(.+)$/);
            if (bulletMatch) {
                parsedLines.push({ type: 'bullet', content: bulletMatch[1], indent: indentLevel });
                continue;
            }

            const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
            if (numberedMatch) {
                parsedLines.push({ 
                    type: 'numbered', 
                    number: parseInt(numberedMatch[1]), 
                    content: numberedMatch[2],
                    indent: indentLevel,
                    endsWithColon: numberedMatch[2].trim().endsWith(':')
                });
                continue;
            }

            parsedLines.push({ type: 'paragraph', content: trimmedLine, indent: indentLevel });
        }

        // Now render with proper nesting
        let i = 0;
        
        while (i < parsedLines.length) {
            const item = parsedLines[i];

            if (item.type === 'empty') {
                i++;
                continue;
            }

            if (item.type === 'divider') {
                elements.push(<hr key={`hr-${key++}`} className="my-4 border-t border-gray-200" />);
                i++;
                continue;
            }

            if (item.type === 'paragraph') {
                elements.push(
                    <p key={`p-${key++}`} className="text-gray-700 my-2 first:mt-0 last:mb-0">
                        {item.content}
                    </p>
                );
                i++;
                continue;
            }

            // Handle numbered list with potential nested bullets
            if (item.type === 'numbered') {
                const numberedItems = [];
                
                while (i < parsedLines.length && parsedLines[i].type === 'numbered') {
                    const numItem = parsedLines[i];
                    const nestedBullets = [];
                    
                    i++;
                    
                    // Collect nested bullet items that follow this numbered item
                    while (i < parsedLines.length && parsedLines[i].type === 'bullet') {
                        nestedBullets.push(parsedLines[i].content);
                        i++;
                    }
                    
                    numberedItems.push({
                        content: numItem.content,
                        nestedBullets
                    });
                }
                
                elements.push(
                    <ol key={`ol-${key++}`} className="list-decimal list-outside ml-5 my-2 space-y-2">
                        {numberedItems.map((numItem, idx) => (
                            <li key={idx} className="text-gray-700 pl-1">
                                <span>{numItem.content}</span>
                                {numItem.nestedBullets.length > 0 && (
                                    <ul className="list-disc list-outside ml-5 mt-2 space-y-1">
                                        {numItem.nestedBullets.map((bullet, bIdx) => (
                                            <li key={bIdx} className="text-gray-700 pl-1">
                                                {bullet}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ol>
                );
                continue;
            }

            // Handle standalone bullet list (not nested under a number)
            if (item.type === 'bullet') {
                const bulletItems = [];
                
                while (i < parsedLines.length && parsedLines[i].type === 'bullet') {
                    bulletItems.push(parsedLines[i].content);
                    i++;
                }
                
                elements.push(
                    <ul key={`ul-${key++}`} className="list-disc list-outside ml-5 my-2 space-y-1">
                        {bulletItems.map((bullet, idx) => (
                            <li key={idx} className="text-gray-700 pl-1">
                                {bullet}
                            </li>
                        ))}
                    </ul>
                );
                continue;
            }

            i++;
        }

        return elements;
    }, [text]);

    if (!text || !formattedContent || formattedContent.length === 0) {
        return null;
    }

    // Variant-specific classes
    const variantClasses = {
        default: 'text-sm sm:text-base leading-relaxed',
        compact: 'text-xs sm:text-sm leading-snug',
        card: 'text-sm leading-relaxed'
    };

    return (
        <div className={`formatted-description ${variantClasses[variant]} ${className}`}>
            {formattedContent}
        </div>
    );
};

/**
 * Preview component for the description editor
 * Shows how the text will be rendered
 */
export const DescriptionPreview = ({
    text = '',
    title = 'Preview',
    className = ''
}) => {
    if (!text) {
        return (
            <div className={`border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 ${className}`}>
                <p className="text-gray-400 text-sm text-center">
                    Preview will appear here as you type...
                </p>
            </div>
        );
    }

    return (
        <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h5 className="text-sm font-medium text-gray-700">{title}</h5>
            </div>
            <div className="p-4 bg-white">
                <FormattedDescription text={text} variant="default" />
            </div>
        </div>
    );
};

export default FormattedDescription;