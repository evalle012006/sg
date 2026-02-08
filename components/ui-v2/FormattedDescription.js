import React, { useMemo } from 'react';

/**
 * Parse inline formatting (bold, italic)
 */
const parseInlineFormatting = (text) => {
    if (!text) return text;
    
    const parts = [];
    let currentIndex = 0;
    let key = 0;
    
    // Regex to match **bold** or *italic* (but not *** which could be a divider)
    const formatRegex = /(\*\*(.+?)\*\*|\*([^*]+?)\*)/g;
    let match;
    
    while ((match = formatRegex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > currentIndex) {
            parts.push(text.substring(currentIndex, match.index));
        }
        
        // Add formatted text
        if (match[0].startsWith('**')) {
            // Bold
            parts.push(
                <strong key={`bold-${key++}`} className="font-semibold">
                    {match[2]}
                </strong>
            );
        } else {
            // Italic
            parts.push(
                <em key={`italic-${key++}`} className="italic">
                    {match[3]}
                </em>
            );
        }
        
        currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
        parts.push(text.substring(currentIndex));
    }
    
    return parts.length > 0 ? parts : text;
};

/**
 * FormattedDescription - Renders plain text with formatting patterns as styled elements
 * Supports:
 * - Bullet lists (lines starting with - or •)
 * - Numbered lists (lines starting with 1., 2., etc.)
 * - Nested lists (bullets under numbered items)
 * - Section headers (lines ending with :)
 * - Horizontal dividers (---)
 * - Inline bold (**text**) and italic (*text*)
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

        // Now render with proper nesting and grouping
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
                        {parseInlineFormatting(item.content)}
                    </p>
                );
                i++;
                continue;
            }

            // Handle numbered list with potential nested bullets and paragraphs
            if (item.type === 'numbered') {
                const numberedItems = [];
                
                while (i < parsedLines.length) {
                    // Check if this is a numbered item
                    if (parsedLines[i].type === 'numbered') {
                        const numItem = parsedLines[i];
                        const nestedContent = [];
                        
                        i++;
                        
                        // Collect content that belongs to this numbered item:
                        // - Nested bullet items
                        // - Paragraphs (that aren't numbered items)
                        // - Empty lines (within reason)
                        let consecutiveEmptyLines = 0;
                        
                        while (i < parsedLines.length) {
                            const nextItem = parsedLines[i];
                            
                            // Stop if we hit another numbered item at the same level
                            if (nextItem.type === 'numbered') {
                                break;
                            }
                            
                            // Handle empty lines - allow one, but stop at two consecutive
                            if (nextItem.type === 'empty') {
                                consecutiveEmptyLines++;
                                if (consecutiveEmptyLines >= 2) {
                                    break; // Two empty lines = end of this numbered item
                                }
                                i++;
                                continue;
                            }
                            
                            // Reset empty line counter when we hit content
                            consecutiveEmptyLines = 0;
                            
                            // Add bullets to nested content
                            if (nextItem.type === 'bullet') {
                                nestedContent.push({ type: 'bullet', content: nextItem.content });
                                i++;
                                continue;
                            }
                            
                            // Add paragraphs to nested content
                            if (nextItem.type === 'paragraph') {
                                nestedContent.push({ type: 'paragraph', content: nextItem.content });
                                i++;
                                continue;
                            }
                            
                            break;
                        }
                        
                        numberedItems.push({
                            content: numItem.content,
                            nestedContent
                        });
                    } else {
                        // If we hit something that's not a numbered item, stop
                        break;
                    }
                }
                
                elements.push(
                    <ol key={`ol-${key++}`} className="list-decimal list-outside ml-5 my-2 space-y-2">
                        {numberedItems.map((numItem, idx) => (
                            <li key={idx} className="text-gray-700 pl-1">
                                <span>{parseInlineFormatting(numItem.content)}</span>
                                {numItem.nestedContent.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                        {/* Group consecutive bullets */}
                                        {(() => {
                                            const nestedElements = [];
                                            let j = 0;
                                            
                                            while (j < numItem.nestedContent.length) {
                                                const nestedItem = numItem.nestedContent[j];
                                                
                                                if (nestedItem.type === 'bullet') {
                                                    // Collect consecutive bullets
                                                    const bullets = [];
                                                    while (j < numItem.nestedContent.length && 
                                                           numItem.nestedContent[j].type === 'bullet') {
                                                        bullets.push(numItem.nestedContent[j].content);
                                                        j++;
                                                    }
                                                    
                                                    nestedElements.push(
                                                        <ul key={`nested-ul-${idx}-${nestedElements.length}`} 
                                                            className="list-disc list-outside ml-5 space-y-1">
                                                            {bullets.map((bullet, bIdx) => (
                                                                <li key={bIdx} className="text-gray-700 pl-1">
                                                                    {parseInlineFormatting(bullet)}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    );
                                                } else if (nestedItem.type === 'paragraph') {
                                                    nestedElements.push(
                                                        <p key={`nested-p-${idx}-${nestedElements.length}`} 
                                                           className="text-gray-700">
                                                            {parseInlineFormatting(nestedItem.content)}
                                                        </p>
                                                    );
                                                    j++;
                                                }
                                            }
                                            
                                            return nestedElements;
                                        })()}
                                    </div>
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
                                {parseInlineFormatting(bullet)}
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
            {title && (
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h5 className="text-sm font-medium text-gray-700">{title}</h5>
                </div>
            )}
            <div className="p-4 bg-white">
                <FormattedDescription text={text} variant="default" />
            </div>
        </div>
    );
};

export default FormattedDescription;