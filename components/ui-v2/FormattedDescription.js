import React, { useMemo } from 'react';

/**
 * Parse inline formatting (bold, italic)
 * Supports: **bold**, *italic*
 */
const parseInlineFormatting = (text) => {
    if (!text) return text;

    const parts = [];
    let currentIndex = 0;
    let key = 0;

    // Match **bold** or *italic* (not ***)
    const formatRegex = /(\*\*(.+?)\*\*|\*([^*]+?)\*)/g;
    let match;

    while ((match = formatRegex.exec(text)) !== null) {
        // Text before match
        if (match.index > currentIndex) {
            parts.push(text.substring(currentIndex, match.index));
        }

        if (match[0].startsWith('**')) {
            parts.push(
                <strong key={`bold-${key++}`} className="font-semibold">
                    {match[2]}
                </strong>
            );
        } else {
            parts.push(
                <em key={`italic-${key++}`} className="italic">
                    {match[3]}
                </em>
            );
        }

        currentIndex = match.index + match[0].length;
    }

    // Remaining text
    if (currentIndex < text.length) {
        parts.push(text.substring(currentIndex));
    }

    return parts.length > 0 ? parts : text;
};

/**
 * Recursively render a nested bullet list from a flat array of
 * { content, indent } items, where indent is 0-based relative to the
 * first item in the group.
 */
const renderBulletList = (items, currentIndent = 0) => {
    const result = [];
    let j = 0;

    while (j < items.length) {
        const current = items[j];

        if (current.indent !== currentIndent) {
            j++;
            continue;
        }

        // Collect children: consecutive items with indent > currentIndent
        const children = [];
        let k = j + 1;
        while (k < items.length && items[k].indent > currentIndent) {
            children.push(items[k]);
            k++;
        }

        result.push(
            <li key={`li-${currentIndent}-${j}`} className="text-gray-700 pl-1">
                {parseInlineFormatting(current.content)}
                {children.length > 0 && (
                    <ul className="list-disc list-outside ml-5 mt-1 space-y-1">
                        {renderBulletList(children, currentIndent + 1)}
                    </ul>
                )}
            </li>
        );

        j = k; // skip past children
    }

    return result;
};

/**
 * FormattedDescription
 *
 * Renders plain/markdown-lite text as styled React elements.
 *
 * Supported syntax
 * ────────────────
 *  **bold**          → <strong>
 *  *italic*          → <em>
 *  - item            → unordered list  (supports indented nesting via leading spaces)
 *  • item            → same as above
 *  1. item           → ordered list    (nested bullets under each item also supported)
 *  ---  /  ***  / ___ → <hr> divider
 *  (blank line)      → paragraph break
 *  any other line    → <p>
 */
const FormattedDescription = ({
    text = '',
    className = '',
    variant = 'default', // 'default' | 'compact' | 'card'
}) => {
    const formattedContent = useMemo(() => {
        if (!text || typeof text !== 'string') return null;

        const lines = text.split('\n');
        const elements = [];
        let key = 0;

        // ── Pass 1: classify every line ──────────────────────────────────────
        const parsedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (!trimmed) {
                parsedLines.push({ type: 'empty' });
                continue;
            }

            // Divider: ---, ***, ___
            if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
                parsedLines.push({ type: 'divider' });
                continue;
            }

            // Bullet: -, •, * (with optional leading spaces for nesting)
            const bulletMatch = trimmed.match(/^[-•*]\s+(.+)$/);
            if (bulletMatch) {
                const rawIndent = line.match(/^(\s*)/)?.[1]?.length || 0;
                parsedLines.push({
                    type: 'bullet',
                    content: bulletMatch[1],
                    indent: Math.floor(rawIndent / 2),
                });
                continue;
            }

            // Numbered: 1. text
            const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
            if (numberedMatch) {
                parsedLines.push({
                    type: 'numbered',
                    number: parseInt(numberedMatch[1], 10),
                    content: numberedMatch[2],
                });
                continue;
            }

            // Paragraph
            parsedLines.push({ type: 'paragraph', content: trimmed });
        }

        // ── Pass 2: group & render ────────────────────────────────────────────
        let i = 0;

        while (i < parsedLines.length) {
            const item = parsedLines[i];

            // ── Empty line ──
            if (item.type === 'empty') {
                i++;
                continue;
            }

            // ── Divider ──
            if (item.type === 'divider') {
                elements.push(
                    <hr
                        key={`hr-${key++}`}
                        className="my-4 border-0 border-t border-gray-200"
                    />
                );
                i++;
                continue;
            }

            // ── Paragraph ──
            if (item.type === 'paragraph') {
                elements.push(
                    <p
                        key={`p-${key++}`}
                        className="text-gray-700 my-2 first:mt-0 last:mb-0"
                    >
                        {parseInlineFormatting(item.content)}
                    </p>
                );
                i++;
                continue;
            }

            // ── Ordered list ──
            if (item.type === 'numbered') {
                const numberedItems = [];

                while (i < parsedLines.length && parsedLines[i].type === 'numbered') {
                    const numItem = parsedLines[i];
                    const nestedContent = [];
                    i++;

                    let emptyCount = 0;

                    while (i < parsedLines.length) {
                        const next = parsedLines[i];

                        if (next.type === 'numbered') break;

                        if (next.type === 'empty') {
                            emptyCount++;
                            if (emptyCount >= 2) break;
                            i++;
                            continue;
                        }

                        emptyCount = 0;

                        if (next.type === 'bullet' || next.type === 'paragraph') {
                            nestedContent.push(next);
                            i++;
                            continue;
                        }

                        break;
                    }

                    numberedItems.push({ content: numItem.content, nestedContent });
                }

                elements.push(
                    <ol
                        key={`ol-${key++}`}
                        className="list-decimal list-outside ml-5 my-2 space-y-2"
                    >
                        {numberedItems.map((numItem, idx) => (
                            <li key={idx} className="text-gray-700 pl-1">
                                <span>{parseInlineFormatting(numItem.content)}</span>

                                {numItem.nestedContent.length > 0 && (
                                    <div className="mt-1 space-y-1">
                                        {(() => {
                                            const nested = [];
                                            let j = 0;

                                            while (j < numItem.nestedContent.length) {
                                                const nc = numItem.nestedContent[j];

                                                // Group consecutive bullets
                                                if (nc.type === 'bullet') {
                                                    const bullets = [];
                                                    const baseIndent = nc.indent || 0;

                                                    while (
                                                        j < numItem.nestedContent.length &&
                                                        numItem.nestedContent[j].type === 'bullet'
                                                    ) {
                                                        const b = numItem.nestedContent[j];
                                                        bullets.push({
                                                            content: b.content,
                                                            indent: (b.indent || 0) - baseIndent,
                                                        });
                                                        j++;
                                                    }

                                                    nested.push(
                                                        <ul
                                                            key={`nested-ul-${idx}-${nested.length}`}
                                                            className="list-disc list-outside ml-5 mt-1 space-y-1"
                                                        >
                                                            {renderBulletList(bullets, 0)}
                                                        </ul>
                                                    );
                                                } else if (nc.type === 'paragraph') {
                                                    nested.push(
                                                        <p
                                                            key={`nested-p-${idx}-${nested.length}`}
                                                            className="text-gray-700"
                                                        >
                                                            {parseInlineFormatting(nc.content)}
                                                        </p>
                                                    );
                                                    j++;
                                                } else {
                                                    j++;
                                                }
                                            }

                                            return nested;
                                        })()}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ol>
                );
                continue;
            }

            // ── Unordered list (top-level, supports nesting via indent) ──
            if (item.type === 'bullet') {
                const bullets = [];

                while (i < parsedLines.length && parsedLines[i].type === 'bullet') {
                    bullets.push({
                        content: parsedLines[i].content,
                        indent: parsedLines[i].indent || 0,
                    });
                    i++;
                }

                // Re-index indents relative to the first item
                const baseIndent = bullets[0]?.indent || 0;
                const reIndexed = bullets.map((b) => ({
                    ...b,
                    indent: b.indent - baseIndent,
                }));

                elements.push(
                    <ul
                        key={`ul-${key++}`}
                        className="list-disc list-outside ml-5 my-2 space-y-1"
                    >
                        {renderBulletList(reIndexed, 0)}
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

    const variantClasses = {
        default: 'text-sm sm:text-base leading-relaxed',
        compact: 'text-xs sm:text-sm leading-snug',
        card: 'text-sm leading-relaxed',
    };

    return (
        <div
            className={`formatted-description ${variantClasses[variant] ?? variantClasses.default} ${className}`}
        >
            {formattedContent}
        </div>
    );
};

/**
 * DescriptionPreview
 *
 * Wraps FormattedDescription in a bordered preview card.
 * Used in the package editor alongside the textarea.
 */
export const DescriptionPreview = ({
    text = '',
    title = 'Preview',
    className = '',
}) => {
    if (!text) {
        return (
            <div
                className={`border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 ${className}`}
            >
                <p className="text-gray-400 text-sm text-center">
                    Preview will appear here as you type…
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