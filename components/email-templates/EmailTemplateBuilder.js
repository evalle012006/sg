import React, { useRef, useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { 
  Home, Save, Info, Eye, Code, Edit3, Bold, Italic, Underline, 
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Link2, 
  Type, Palette, Minus, ChevronDown, ChevronRight, RefreshCw, X, Lock, AlertTriangle,
  Search
} from 'lucide-react';
import TemplateHelperDocumentation from './TemplateHelperDocumentation';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const Spinner = dynamic(() => import('../ui/spinner'));
const ConfirmDialog = dynamic(() => import('../ui-v2/ConfirmDialog'));

// Updated default template with centered header/footer and no default buttons
const DEFAULT_TEMPLATE_HTML = `<!doctype html>
<html lang="en-US">
<head>
    <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email from Sargood on Collaroy</title>
    <style type="text/css">
        body {
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: 15px;
            line-height: 1.6;
            color: #1f2937;
        }
        .container {
            max-width: 560px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 40px;
        }
        h1 {
            color: #1f2937;
            font-size: 22px;
            font-weight: 600;
            margin: 0 0 24px 0;
        }
        h2 {
            color: #1f2937;
            font-size: 18px;
            font-weight: 600;
            margin: 24px 0 16px 0;
        }
        p {
            margin: 0 0 16px 0;
        }
        .details-box {
            background-color: #f9fafb;
            border-left: 3px solid #6b7280;
            padding: 20px;
            margin: 24px 0;
        }
        .details-box h2 {
            font-size: 14px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 16px 0;
        }
        .detail-row {
            display: block;
            margin-bottom: 12px;
        }
        .detail-label {
            color: #6b7280;
            font-size: 13px;
            display: block;
            margin-bottom: 2px;
        }
        .detail-value {
            color: #1f2937;
            font-weight: 500;
        }
        .btn {
            display: inline-block;
            background-color: #ffd000;
            color: #1f2937 !important;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 14px;
            margin: 8px 8px 8px 0;
        }
        .btn-outline {
            background-color: transparent;
            border: 1px solid #d1d5db;
            color: #374151 !important;
        }
        .note {
            background-color: #fef3c7;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
            font-size: 14px;
        }
        .note strong {
            color: #92400e;
        }
        .info-box {
            background-color: #dbeafe;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
            font-size: 14px;
        }
        .info-box strong {
            color: #1e40af;
        }
        .success-box {
            background-color: #d1fae5;
            border-radius: 6px;
            padding: 16px;
            margin: 24px 0;
            font-size: 14px;
        }
        .success-box strong {
            color: #065f46;
        }
        .divider {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 32px 0;
        }
        .footer {
            color: #6b7280;
            font-size: 13px;
            text-align: center;
        }
        .footer a {
            color: #075985;
            text-decoration: none;
        }
        a {
            color: #075985;
        }
        .logo {
            text-align: center;
            margin-bottom: 32px;
        }
        .logo img {
            max-width: 200px;
            height: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        table th {
            background-color: #f3f4f6;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
        }
        table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        @media only screen and (max-width: 600px) {
            .container {
                width: 100% !important;
                padding: 20px !important;
            }
            .btn {
                display: block !important;
                width: 100% !important;
                margin-bottom: 10px !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        {{#if logo_base64}}
        <div class="logo">
            <img src="{{logo_base64}}" alt="Sargood on Collaroy" />
        </div>
        {{/if}}
        
        <h1>Email Title</h1>

        <p>Dear {{guest_name}},</p>

        <p>Your email content goes here. You can use merge tags from the sidebar to insert dynamic content.</p>

        <div class="details-box">
            <h2>Important Details</h2>
            <div>
                {{#if (isNotEmpty please_select_the_services_that_you_are_interested_in_using_during_your_stay_raw)}}
                <ul>
                  {{#each please_select_the_services_that_you_are_interested_in_using_during_your_stay_raw}}
                  <li>
                    {{this.label}}
                    {{#if this.subOptions.length}}
                      <ul style="margin-top: 4px;">
                        {{#each this.subOptions}}
                        <li style="font-size: 13px; color: #6b7280;">{{this}}</li>
                        {{/each}}
                      </ul>
                    {{/if}}
                  </li>
                  {{/each}}
                </ul>
                {{else}}
                <p>No services selected</p>
                {{/if}}
            </div>
        </div>

        <p>Additional content and information.</p>

        <hr class="divider">

        <div class="footer">
            <p><strong>Sargood on Collaroy</strong></p>
            <p>
                Phone: <a href="tel:0285970600">02 8597 0600</a><br>
                Email: <a href="mailto:info@sargoodoncollaroy.com.au">info@sargoodoncollaroy.com.au</a>
            </p>
            <p style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
                1 Brissenden Avenue, Collaroy NSW 2097, Australia
            </p>
        </div>
    </div>
</body>
</html>`;

const EmailTemplateBuilder = ({ mode, templateId, onCancel, onSuccess }) => {
  const isAddMode = mode === 'add';
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';
  
  const editorRef = useRef(null);
  const isUpdatingRef = useRef(false);
  
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState(''); // This stores the full HTML
  const [editorContent, setEditorContent] = useState(''); // This stores only body content for editing
  const [htmlWrapper, setHtmlWrapper] = useState(null); // Stores the head/style wrapper
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [showMergeTags, setShowMergeTags] = useState(false);
  const [templateData, setTemplateData] = useState(null);
  const [viewMode, setViewMode] = useState('editor');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [showHelperMenu, setShowHelperMenu] = useState(false);
  const [selectedMergeTag, setSelectedMergeTag] = useState(null);
  const [showHelperModal, setShowHelperModal] = useState(false);
  const [systemTemplateInfo, setSystemTemplateInfo] = useState(null);
  const [mergeTagsGrouped, setMergeTagsGrouped] = useState({});
  const [isLoadingMergeTags, setIsLoadingMergeTags] = useState(true);
  const [mergeTagsError, setMergeTagsError] = useState(null);
  const [mergeTagSearch, setMergeTagSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showComponentMenu, setShowComponentMenu] = useState(false);
  const [showSaveConfirmDialog, setShowSaveConfirmDialog] = useState(false);
  const [hyphenatedTagsValidation, setHyphenatedTagsValidation] = useState(null);

  const commonColors = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  ];

  /**
   * Convert static logo images back to Handlebars format for email sending
   */
  const convertStaticLogoToHandlebars = (html) => {
    if (!html) return html;
    
    // Pattern to match static logo img tags (both in editor format and manual edits)
    const staticLogoPattern = /<div[^>]*(?:class="logo"|style="text-align:\s*center)[^>]*>[\s\S]*?<img[^>]*src=["'](?:\/images\/sargood-logo\.png|\/sargood-logo[^"']*\.(?:png|svg))["'][^>]*>[\s\S]*?<\/div>/gi;
    
    // Replace with Handlebars conditional
    const handlebarsLogo = `{{#if logo_base64}}
          <div class="logo">
              <img src="{{logo_base64}}" alt="Sargood on Collaroy" />
          </div>
          {{/if}}`;
    
    return html.replace(staticLogoPattern, handlebarsLogo);
  };

  // Helper function to replace logo merge tags with actual logo for editor display
  const getEditorDisplayContent = (content) => {
    if (!content) return '';
    
    const logoPattern = /\{\{#if logo_base64\}\}[\s\S]*?\{\{\/if\}\}/gi;
    
    return content.replace(logoPattern, 
      `<div style="text-align: center; margin-bottom: 32px;">
        <img src="/images/sargood-logo.png" alt="Sargood on Collaroy" style="max-width: 200px; height: auto; display: inline-block;" />
      </div>`
    );
  };

  const insertPrimaryButton = () => {
    const buttonHtml = `<a href="#" class="btn">Button Text</a>`;
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, buttonHtml);
      updateContent();
    }
  };

  const insertSecondaryButton = () => {
    const buttonHtml = `<a href="#" class="btn btn-outline">Button Text</a>`;
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, buttonHtml);
      updateContent();
    }
  };

  const insertDetailsBox = () => {
    const boxHtml = `<div class="details-box">
      <h2>Details Title</h2>
      <div class="detail-row">
          <span class="detail-label">Label</span>
          <span class="detail-value">Value</span>
      </div>
  </div>`;
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, boxHtml);
      updateContent();
    }
  };

  const insertNoteBox = () => {
    const noteHtml = `<div class="note">
      <strong>Note:</strong> Your note content here.
  </div>`;
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, noteHtml);
      updateContent();
    }
  };

  const insertInfoBox = () => {
    const infoHtml = `<div class="info-box">
      <strong>Info:</strong> Your information here.
  </div>`;
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, infoHtml);
      updateContent();
    }
  };

  const insertSuccessBox = () => {
    const successHtml = `<div class="success-box">
      <strong>Success:</strong> Your success message here.
  </div>`;
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, successHtml);
      updateContent();
    }
  };

  // Filter merge tags based on search
  const filteredMergeTags = useMemo(() => {
    if (!mergeTagSearch.trim()) {
      return mergeTagsGrouped;
    }

    const searchLower = mergeTagSearch.toLowerCase();
    const filtered = {};

    Object.entries(mergeTagsGrouped).forEach(([category, tags]) => {
      const matchingTags = tags.filter(tag => 
        tag.label.toLowerCase().includes(searchLower) ||
        tag.value.toLowerCase().includes(searchLower) ||
        (tag.description && tag.description.toLowerCase().includes(searchLower))
      );

      if (matchingTags.length > 0) {
        filtered[category] = matchingTags;
      }
    });

    return filtered;
  }, [mergeTagsGrouped, mergeTagSearch]);

  // Auto-expand categories when searching
  useEffect(() => {
    if (mergeTagSearch.trim()) {
      // Expand all categories when searching
      const allExpanded = {};
      Object.keys(filteredMergeTags).forEach(category => {
        allExpanded[category] = true;
      });
      setExpandedCategories(allExpanded);
    } else {
      // Collapse all when search is cleared
      setExpandedCategories({});
    }
  }, [mergeTagSearch, filteredMergeTags]);

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    Object.keys(filteredMergeTags).forEach(category => {
      allExpanded[category] = true;
    });
    setExpandedCategories(allExpanded);
  };

  const collapseAll = () => {
    setExpandedCategories({});
  };

  // Helper function to check if content is a full HTML document
  const isFullHtmlDocument = (html) => {
    if (!html) return false;
    const trimmed = html.trim().toLowerCase();
    return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
  };

  // Helper function to extract body content and wrapper from full HTML
  const parseHtmlDocument = (html) => {
    if (!html) return { bodyContent: '', wrapper: null };
    
    if (!isFullHtmlDocument(html)) {
      // Not a full document, return as-is
      return { bodyContent: html, wrapper: null };
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Extract body content
      const bodyContent = doc.body ? doc.body.innerHTML : html;
      
      // Extract head content for wrapper
      const headContent = doc.head ? doc.head.innerHTML : '';
      
      // Store wrapper info
      const wrapper = {
        hasDoctype: html.trim().toLowerCase().startsWith('<!doctype'),
        headContent: headContent,
        htmlLang: doc.documentElement?.getAttribute('lang') || 'en'
      };
      
      return { bodyContent, wrapper };
    } catch (error) {
      console.error('Error parsing HTML document:', error);
      return { bodyContent: html, wrapper: null };
    }
  };

  // Helper function to reconstruct full HTML from body content
  const reconstructFullHtml = (bodyContent, wrapper) => {
    if (!wrapper) {
      // Not a full document, return body content as-is
      return bodyContent;
    }

    return `<!DOCTYPE html>
<html lang="${wrapper.htmlLang}">
<head>
${wrapper.headContent}
</head>
<body>
${bodyContent}
</body>
</html>`;
  };

  useEffect(() => {
    fetchMergeTags();
  }, []);

  useEffect(() => {
    if (templateId && !isAddMode) {
      fetchTemplate();
    } else {
      setContent('');
      setEditorContent('');
      setHtmlWrapper(null);
      setIsPageLoading(false);
    }
  }, [templateId, isAddMode]);

  const fetchMergeTags = async () => {
    try {
      setIsLoadingMergeTags(true);
      setMergeTagsError(null);
      
      const response = await fetch('/api/email-templates/merge-tags');
      
      if (!response.ok) {
        throw new Error('Failed to fetch merge tags');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setMergeTagsGrouped(data.data);
      } else {
        throw new Error(data.message || 'Failed to load merge tags');
      }
    } catch (error) {
      console.error('Error fetching merge tags:', error);
      setMergeTagsError(error.message);
      toast.error('Failed to load merge tags. Using defaults.');
      
      setMergeTagsGrouped({
        'Guest Information': [
          { label: 'Guest Name', value: '{{guest_name}}', description: 'Full name of the guest' },
          { label: 'Guest Email', value: '{{guest_email}}', description: 'Guest email address' },
          { label: 'Guest Phone', value: '{{guest_phone}}', description: 'Guest phone number' },
        ],
        'Booking Details': [
          { label: 'Booking Reference', value: '{{booking_reference}}', description: 'Unique booking ID' },
          { label: 'Check-in Date', value: '{{checkin_date}}', description: 'Arrival date' },
          { label: 'Check-out Date', value: '{{checkout_date}}', description: 'Departure date' },
        ],
      });
    } finally {
      setIsLoadingMergeTags(false);
    }
  };

  const fetchTemplate = async () => {
    try {
      setIsPageLoading(true);
      const response = await fetch(`/api/email-templates/${templateId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const template = data.data;
          setTemplateData(template);
          setName(template.name || '');
          setSubject(template.subject || '');
          setDescription(template.description || '');
          
          // Parse the HTML content
          const htmlContent = template.html_content || '';
          setContent(htmlContent);
          
          const { bodyContent, wrapper } = parseHtmlDocument(htmlContent);
          setEditorContent(bodyContent);
          setHtmlWrapper(wrapper);
          
          if (template.is_system) {
            setSystemTemplateInfo({
              isSystem: true,
              templateCode: template.template_code,
              requiredVariables: template.required_variables || [],
              variableDescriptions: template.variable_description || {}
            });
          } else {
            setSystemTemplateInfo(null);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Failed to load template');
    } finally {
      setIsPageLoading(false);
    }
  };

  // Sync editor content to the contentEditable div
  useEffect(() => {
    if (editorRef.current && viewMode === 'editor' && !isUpdatingRef.current) {
      const displayContent = getEditorDisplayContent(editorContent);
      const currentContent = editorRef.current.innerHTML;
      if (currentContent !== displayContent) {
        editorRef.current.innerHTML = displayContent || '';
      }
    }
  }, [viewMode, templateData, editorContent]);

  const validateFields = () => {
    let isValid = true;

    if (!name.trim()) {
      setNameError('Template name is required');
      isValid = false;
    } else if (name.trim().length < 3) {
      setNameError('Template name must be at least 3 characters');
      isValid = false;
    } else {
      setNameError('');
    }

    if (!subject.trim()) {
      setSubjectError('Email subject is required');
      isValid = false;
    } else {
      setSubjectError('');
    }

    return isValid;
  };

  const insertMergeTag = (tagValue) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, tagValue);
      updateContent();
    }
  };

  const execCommand = (command, value = null) => {
    if (editorRef.current && !isViewMode) {
      document.execCommand(command, false, value);
      editorRef.current.focus();
      updateContent();
    }
  };

  const insertLink = () => {
    if (!linkUrl || !linkText) {
      toast.error('Please enter both URL and link text');
      return;
    }
    
    const linkHtml = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    execCommand('insertHTML', linkHtml);
    setShowLinkDialog(false);
    setLinkUrl('');
    setLinkText('');
  };

  const insertList = (tagName) => {
    // Convert hyphens to underscores and add _raw suffix for array iteration
    const cleanTagName = tagName.replace(/-/g, '_');
    const arrayTagName = `${cleanTagName}_raw`;
    
    const listTemplate = `{{#if (isNotEmpty ${arrayTagName})}}
      <ul>
        {{#each ${arrayTagName}}}
        <li>{{this}}</li>
        {{/each}}
      </ul>
      {{else}}
      <p>No items</p>
      {{/if}}`;
    
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, listTemplate);
      updateContent();
    }
    setShowHelperMenu(false);
  };

  const insertTable = (tagName) => {
    const tableTemplate = `{{#if (isNotEmpty ${tagName})}}
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr style="background-color: #f0f0f0;">
          <th>Column 1</th>
          <th>Column 2</th>
          <th>Column 3</th>
        </tr>
      </thead>
      <tbody>
        {{#each ${tagName}}}
        <tr>
          <td>{{this.field1}}</td>
          <td>{{this.field2}}</td>
          <td>{{this.field3}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    {{else}}
    <p>No data available</p>
    {{/if}}`;

    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, tableTemplate);
      updateContent();
    }
    setShowHelperMenu(false);
  };

  const insertConditional = (tagName) => {
    const conditionalTemplate = `{{#if ${tagName}}}
    <div>
      <p>${tagName}: {{${tagName}}}</p>
    </div>
    {{else}}
    <p>Not provided</p>
    {{/if}}`;

    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, conditionalTemplate);
      updateContent();
    }
    setShowHelperMenu(false);
  };

  const applyColor = (color) => {
    execCommand('foreColor', color);
    setShowColorPicker(false);
  };

  const handleMergeTagClick = (tag) => {
    setSelectedMergeTag(tag);
    setShowHelperMenu(true);
  };

  const insertSimpleMergeTag = (tag) => {
    insertMergeTag(tag.value);
    setShowHelperMenu(false);
  };

  const updateContent = () => {
    if (editorRef.current) {
      isUpdatingRef.current = true;
      const newEditorContent = editorRef.current.innerHTML;
      setEditorContent(newEditorContent);
      
      // Reconstruct full HTML if we have a wrapper
      const fullHtml = reconstructFullHtml(newEditorContent, htmlWrapper);
      setContent(fullHtml);
      
      requestAnimationFrame(() => {
        isUpdatingRef.current = false;
      });
    }
  };

  // Handle code view changes
  const handleCodeChange = (newCode) => {
    setContent(newCode);
    
    // Re-parse to update editor content
    const { bodyContent, wrapper } = parseHtmlDocument(newCode);
    setEditorContent(bodyContent);
    setHtmlWrapper(wrapper);
  };

  const handleEditorFocus = () => {
    // Don't clear content on focus
  };

  const validateTemplateForHyphenatedTags = (html) => {
    // Find all hyphenated merge tags (excluding bracket notation)
    const hyphenatedTagPattern = /\{\{(?!\[)[#/]?(\w+(?:-\w+)+)[^}]*\}\}/g;
    const matches = [];
    let match;

    while ((match = hyphenatedTagPattern.exec(html)) !== null) {
      matches.push(match[1]);
    }

    return {
      hasIssues: matches.length > 0,
      hyphenatedTags: [...new Set(matches)],
      count: matches.length
    };
  };

  const handleSave = async () => {
    if (!validateFields()) {
      toast.error('Please fix the validation errors');
      return;
    }

    // ✨ Check for hyphenated tags
    const validation = validateTemplateForHyphenatedTags(content);
    
    if (validation.hasIssues) {
      // Store validation results and show dialog
      setHyphenatedTagsValidation(validation);
      setShowSaveConfirmDialog(true);
      return; // Don't proceed with save yet
    }

    // If no issues, proceed with save
    await performSave();
  };

  // Separated save logic for reuse
  const performSave = async () => {
    setIsLoading(true);

    try {
      // ✨ Convert static logo images back to Handlebars format
      let htmlToSave = content;
      htmlToSave = convertStaticLogoToHandlebars(htmlToSave);
      
      const templatePayload = {
        name: name.trim(),
        subject: subject.trim(),
        description: description.trim(),
        html_content: htmlToSave,  // ← Use converted HTML
        json_design: { html: htmlToSave },
        is_active: templateData?.is_active !== undefined ? templateData.is_active : true
      };

      const url = isEditMode
        ? `/api/email-templates/${templateId}`
        : '/api/email-templates';

      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePayload)
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.is_system) {
          if (result.missing_variables && result.missing_variables.length > 0) {
            toast.error(
              <div>
                <strong>Required Variables Missing</strong>
                <p className="text-sm mt-1">{result.message}</p>
              </div>,
              { autoClose: 8000 }
            );
          } else {
            toast.error(result.message || 'Failed to save template');
          }
        } else {
          throw new Error(result.message || 'Failed to save template');
        }
        return;
      }

      toast.success('Email template saved successfully');
      onSuccess();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.message || 'Failed to save template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSaveWithHyphens = () => {
    setShowSaveConfirmDialog(false);
    setHyphenatedTagsValidation(null);
    performSave();
  };

  const handleCancelSave = () => {
    setShowSaveConfirmDialog(false);
    setHyphenatedTagsValidation(null);
  };

  const autoFixHyphenatedTags = () => {
    const validation = validateTemplateForHyphenatedTags(content);
    
    if (!validation.hasIssues) {
      toast.info('No hyphenated tags found. Template looks good!');
      return;
    }

    const convertedHtml = content.replace(
      /\{\{(?!\[)([#/]?)(\w+(?:-\w+)+)([^}]*)\}\}/g,
      (match, prefix, tagName, suffix) => {
        // Convert to underscore
        const underscoreTag = tagName.replace(/-/g, '_');
        
        // For #each blocks, add _raw suffix
        const finalTag = (prefix === '#' && match.includes('#each'))
          ? `${underscoreTag}_raw`
          : underscoreTag;
        
        return `{{${prefix}${finalTag}${suffix}}}`;
      }
    );

    setContent(convertedHtml);
    const { bodyContent, wrapper } = parseHtmlDocument(convertedHtml);
    setEditorContent(bodyContent);
    setHtmlWrapper(wrapper);

    toast.success(
      `✅ Auto-fixed ${validation.count} hyphenated tag(s)!`,
      { autoClose: 3000 }
    );
  };

  useEffect(() => {
    if (templateId && !isAddMode) {
      fetchTemplate();
    } else if (isAddMode) {
      // Set default template with styling for new templates
      setContent(DEFAULT_TEMPLATE_HTML);
      
      const { bodyContent, wrapper } = parseHtmlDocument(DEFAULT_TEMPLATE_HTML);
      setEditorContent(bodyContent);
      setHtmlWrapper(wrapper);
      setIsPageLoading(false);
    } else {
      setContent('');
      setEditorContent('');
      setHtmlWrapper(null);
      setIsPageLoading(false);
    }
  }, [templateId, isAddMode]);

  // After fetching template, check for hyphenated tags
  useEffect(() => {
    if (content) {
      const hasHyphenatedTags = /\{\{(?!\[)[#/]?\w+(?:-\w+)+[^}]*\}\}/g.test(content);
      if (hasHyphenatedTags) {
        toast.warning(
          'This template uses hyphenated merge tags which are deprecated. Consider updating to underscore format (e.g., {{my_tag}} instead of {{my-tag}}).',
          { autoClose: 10000 }
        );
      }
    }
  }, [content]);

  const getPreviewContent = () => {
    return content;
  };

  if (isPageLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-gray-50 min-h-screen w-full">
      {/* Global styles for editor placeholder */}
      <style>{`
        .email-editor[data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #999;
          font-style: italic;
          pointer-events: none;
        }
      `}</style>

      {/* Header - Responsive */}
      <div className="bg-white border-b px-4 md:px-6 py-3 md:py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center flex-wrap gap-2 text-xs sm:text-sm text-gray-600">
            <Home className="w-3 h-3 sm:w-4 sm:h-4" />
            <button 
              onClick={onCancel}
              className="hover:text-blue-600 transition-colors"
            >
              EMAIL TEMPLATES
            </button>
            <span>/</span>
            <span className="font-medium">
              {isAddMode && 'CREATE TEMPLATE'}
              {isEditMode && 'EDIT TEMPLATE'}
              {isViewMode && 'VIEW TEMPLATE'}
            </span>
            {systemTemplateInfo && systemTemplateInfo.isSystem && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                <Lock className="w-3 h-3 mr-1" />
                SYSTEM
              </span>
            )}
          </div>
          
          {!isViewMode && (
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                type="button"
                color="primary"
                size="medium"
                label={isLoading ? 'Saving...' : 'Save'}
                onClick={handleSave}
                disabled={isLoading}
                icon={<Save className="w-4 h-4" />}
              />
              <Button
                type="button"
                color="secondary"
                size="medium"
                label="Cancel"
                onClick={onCancel}
                disabled={isLoading}
              />
            </div>
          )}
        </div>
      </div>

      {/* System Template Protection Notice - Responsive */}
      {systemTemplateInfo && systemTemplateInfo.isSystem && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 px-4 md:px-6 py-3 md:py-4 flex-shrink-0">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">
                System Template - Protected
              </h3>
              <div className="text-xs sm:text-sm text-yellow-700 space-y-2">
                <p>
                  This is a system-critical template (<code className="px-1 py-0.5 bg-yellow-100 rounded font-mono text-xs">{systemTemplateInfo.templateCode}</code>) that cannot be deleted or deactivated.
                </p>
                {systemTemplateInfo.requiredVariables.length > 0 && (
                  <div className="bg-yellow-100 rounded-lg p-2 sm:p-3">
                    <p className="font-medium mb-2">Required Variables (must remain):</p>
                    <ul className="space-y-1 text-xs">
                      {systemTemplateInfo.requiredVariables.map((varName) => (
                        <li key={varName} className="break-all">
                          <code className="px-1 py-0.5 bg-white rounded font-mono">{`{{${varName}}}`}</code>
                          {systemTemplateInfo.variableDescriptions[varName] && (
                            <span className="ml-2 text-yellow-600">
                              - {systemTemplateInfo.variableDescriptions[varName]}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-start gap-2 bg-yellow-50 rounded p-2">
                    <span className="text-green-600 flex-shrink-0">✓</span>
                    <span>You can modify HTML, CSS, and appearance</span>
                  </div>
                  <div className="flex items-start gap-2 bg-yellow-50 rounded p-2">
                    <span className="text-red-600 flex-shrink-0">✗</span>
                    <span>Cannot delete or remove required variables</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full HTML Document Notice */}
      {htmlWrapper && !isViewMode && (
        <div className="bg-blue-50 border-l-4 border-blue-400 px-4 md:px-6 py-2 md:py-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-700">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>
              <strong>Full HTML Document:</strong> This template contains head/style sections. 
              The visual editor shows only the body content. Use <strong>HTML view</strong> to edit styles and head content.
            </span>
          </div>
        </div>
      )}

      {/* Template Details Section - Responsive Grid */}
      <div className="bg-white border-b px-4 md:px-6 py-3 md:py-4 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <TextField
            label="Template Name"
            value={name}
            onChange={(value) => setName(value)}
            placeholder="Enter template name"
            error={nameError}
            disabled={isViewMode}
            required
          />
          <TextField
            label="Email Subject"
            value={subject}
            onChange={(value) => setSubject(value)}
            placeholder="Enter email subject"
            error={subjectError}
            disabled={isViewMode}
            required
          />
          <TextField
            label="Description (Optional)"
            value={description}
            onChange={(value) => setDescription(value)}
            placeholder="Brief description"
            disabled={isViewMode}
          />
        </div>
      </div>

      {/* View Mode Switcher - Responsive */}
      <div className="bg-white border-b px-4 md:px-6 py-2 md:py-3 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setViewMode('editor')}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap text-sm ${
                viewMode === 'editor'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={isViewMode}
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">Editor</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap text-sm ${
                viewMode === 'preview'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap text-sm ${
                viewMode === 'code'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={isViewMode}
            >
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">HTML</span>
            </button>
          </div>

          {!isViewMode && (
            <div className="flex gap-2 overflow-x-auto">
              <button
                onClick={() => setShowMergeTags(!showMergeTags)}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap text-sm ${
                  showMergeTags
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Type className="w-4 h-4" />
                <span className="hidden sm:inline">{showMergeTags ? 'Hide' : 'Show'} Tags</span>
                <span className="sm:hidden">Tags</span>
              </button>
              <button
                onClick={fetchMergeTags}
                className="px-3 py-2 rounded-lg flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-sm"
                title="Refresh merge tags"
                disabled={isLoadingMergeTags}
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingMergeTags ? 'animate-spin' : ''}`} />
              </button>
              <button
                  onClick={autoFixHyphenatedTags}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors text-sm"
                  title="Auto-fix hyphenated tags"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">Fix Tags</span>
                </button>
              <button
                onClick={() => setShowHelperModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm"
                title="View helper guide"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Help</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area - Responsive Flex Layout */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        {/* Merge Tags Sidebar - IMPROVED with collapsible categories */}
        {showMergeTags && !isViewMode && (
          <div className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r flex-shrink-0 flex flex-col h-96 lg:h-full">
            {/* Sticky Header with Search */}
            <div className="p-4 border-b bg-white flex-shrink-0">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2 text-sm lg:text-base">
                <Type className="w-4 h-4 lg:w-5 lg:h-5" />
                Merge Tags
              </h3>
              
              {/* Search Input */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={mergeTagSearch}
                  onChange={(e) => setMergeTagSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {mergeTagSearch && (
                  <button
                    onClick={() => setMergeTagSearch('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Expand/Collapse All - Only show when not searching */}
              {!mergeTagSearch && Object.keys(mergeTagsGrouped).length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={expandAll}
                    className="flex-1 text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAll}
                    className="flex-1 text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                  >
                    Collapse All
                  </button>
                </div>
              )}
            </div>

            {/* Scrollable Tags Content */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {isLoadingMergeTags && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Spinner />
                  <span className="text-sm text-gray-600 mt-2">Loading merge tags...</span>
                </div>
              )}

              {mergeTagsError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-xs sm:text-sm text-yellow-800">
                    <Info className="w-4 h-4 inline mr-1" />
                    {mergeTagsError}
                  </p>
                </div>
              )}
              
              {!isLoadingMergeTags && Object.entries(filteredMergeTags).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(filteredMergeTags).map(([category, tags]) => {
                    const isExpanded = expandedCategories[category];
                    const tagCount = tags.length;

                    return (
                      <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Category Header - Clickable */}
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            )}
                            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
                              {category}
                            </h4>
                          </div>
                          <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
                            {tagCount}
                          </span>
                        </button>

                        {/* Category Content - Collapsible */}
                        {isExpanded && (
                          <div className="p-2 space-y-1 bg-white">
                            {tags.map((tag, index) => (
                              <button
                                key={index}
                                onClick={() => handleMergeTagClick(tag)}
                                className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all duration-150"
                                title={tag.description}
                              >
                                <div className="font-medium text-xs sm:text-sm text-gray-900">{tag.label}</div>
                                <div className="text-xs text-blue-600 mt-0.5 font-mono break-all">{tag.value}</div>
                                {tag.description && (
                                  <div className="text-xs text-gray-500 mt-1">{tag.description}</div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : !isLoadingMergeTags && mergeTagSearch ? (
                <div className="text-center py-8 text-gray-500">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium mb-1">No tags found</p>
                  <p className="text-xs">Try a different search term</p>
                  <button
                    onClick={() => setMergeTagSearch('')}
                    className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Clear search
                  </button>
                </div>
              ) : !isLoadingMergeTags && Object.keys(mergeTagsGrouped).length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium mb-1">No merge tags available</p>
                  <button
                    onClick={fetchMergeTags}
                    className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reload tags
                  </button>
                </div>
              ) : null}
            </div>

            {/* Tags Count Footer */}
            {!isLoadingMergeTags && Object.keys(filteredMergeTags).length > 0 && (
              <div className="p-3 border-t bg-gray-50 flex-shrink-0">
                <p className="text-xs text-gray-600 text-center">
                  {Object.values(filteredMergeTags).reduce((sum, tags) => sum + tags.length, 0)} tags
                  {mergeTagSearch && ` matching "${mergeTagSearch}"`}
                  {!mergeTagSearch && ` in ${Object.keys(filteredMergeTags).length} categories`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Editor Area - Responsive */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Toolbar - Responsive with horizontal scroll */}
          {viewMode === 'editor' && !isViewMode && (
            <div className="bg-white border-b px-2 sm:px-4 py-2 flex-shrink-0 overflow-x-auto sticky top-0 z-10">
              <div className="flex items-center gap-1 min-w-max">
                {/* Text Formatting */}
                <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
                  <button
                    onClick={() => execCommand('bold')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Bold"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => execCommand('italic')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Italic"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => execCommand('underline')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Underline"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                </div>

                {/* Font Size */}
                <div className="flex items-center gap-1 px-2 border-r border-gray-200">
                  <select
                    onChange={(e) => execCommand('fontSize', e.target.value)}
                    className="text-xs sm:text-sm border border-gray-300 rounded px-2 py-1"
                    defaultValue="3"
                  >
                    <option value="1">Small</option>
                    <option value="3">Normal</option>
                    <option value="5">Large</option>
                    <option value="7">Huge</option>
                  </select>
                </div>

                {/* Color */}
                <div className="relative px-2 border-r border-gray-200">
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="p-2 hover:bg-gray-100 rounded flex items-center gap-1"
                    title="Text Color"
                  >
                    <Palette className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  
                  {showColorPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-10">
                      <div className="grid grid-cols-10 gap-1 w-56">
                        {commonColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => applyColor(color)}
                            className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => {
                          setSelectedColor(e.target.value);
                          applyColor(e.target.value);
                        }}
                        className="w-full mt-2 h-8 rounded border border-gray-300"
                      />
                    </div>
                  )}
                </div>

                {/* Alignment */}
                <div className="flex items-center gap-1 px-2 border-r border-gray-200">
                  <button
                    onClick={() => execCommand('justifyLeft')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Align Left"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => execCommand('justifyCenter')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Align Center"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => execCommand('justifyRight')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Align Right"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Lists */}
                <div className="flex items-center gap-1 px-2 border-r border-gray-200">
                  <button
                    onClick={() => execCommand('insertUnorderedList')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Bullet List"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => execCommand('insertOrderedList')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Numbered List"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>
                </div>

                {/* Link */}
                <div className="relative px-2 border-r border-gray-200">
                  <button
                    onClick={() => setShowLinkDialog(!showLinkDialog)}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Insert Link"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  
                  {showLinkDialog && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-10 w-80">
                      <h4 className="font-medium mb-3 text-sm">Insert Link</h4>
                      <input
                        type="text"
                        placeholder="Link text"
                        value={linkText}
                        onChange={(e) => setLinkText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <input
                        type="url"
                        placeholder="https://example.com"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={insertLink}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex-1 text-sm"
                        >
                          Insert
                        </button>
                        <button
                          onClick={() => {
                            setShowLinkDialog(false);
                            setLinkUrl('');
                            setLinkText('');
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Horizontal Rule */}
                <div className="px-2 border-r border-gray-200">
                  <button
                    onClick={() => execCommand('insertHorizontalRule')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Horizontal Line"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>

                {/* Components Dropdown - NEW */}
                <div className="relative px-2">
                  <button
                    onClick={() => setShowComponentMenu(!showComponentMenu)}
                    className="p-2 hover:bg-gray-100 rounded flex items-center gap-1"
                    title="Insert Components"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span className="text-xs hidden sm:inline">Components</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  
                  {showComponentMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg py-1 z-50 w-56">
                      <button
                        onClick={() => {
                          insertPrimaryButton();
                          setShowComponentMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-8 h-6 bg-yellow-400 rounded flex items-center justify-center text-xs">Btn</div>
                        <span className="text-sm">Primary Button</span>
                      </button>
                      <button
                        onClick={() => {
                          insertSecondaryButton();
                          setShowComponentMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-8 h-6 border border-gray-400 rounded flex items-center justify-center text-xs">Btn</div>
                        <span className="text-sm">Secondary Button</span>
                      </button>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={() => {
                          insertDetailsBox();
                          setShowComponentMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-6 h-6 bg-gray-100 border-l-2 border-gray-400 flex items-center justify-center">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <span className="text-sm">Details Box</span>
                      </button>
                      <button
                        onClick={() => {
                          insertNoteBox();
                          setShowComponentMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-6 h-6 bg-yellow-100 rounded flex items-center justify-center text-xs">!</div>
                        <span className="text-sm">Note Box (Yellow)</span>
                      </button>
                      <button
                        onClick={() => {
                          insertInfoBox();
                          setShowComponentMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center text-xs">i</div>
                        <span className="text-sm">Info Box (Blue)</span>
                      </button>
                      <button
                        onClick={() => {
                          insertSuccessBox();
                          setShowComponentMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center text-xs">✓</div>
                        <span className="text-sm">Success Box (Green)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Editor View */}
          {viewMode === 'editor' && (
            <div className="bg-gray-50 p-3 sm:p-4 md:p-6 flex-1 w-full overflow-auto">
              <div className="max-w-4xl mx-auto bg-white border border-gray-300 rounded-lg shadow-sm">
                {/* Inject styles for better editor rendering */}
                <style>{`
                  .email-editor {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    font-size: 15px;
                    line-height: 1.6;
                    color: #1f2937;
                  }
                  .email-editor h1 {
                    color: #1f2937;
                    font-size: 22px;
                    font-weight: 600;
                    margin: 0 0 24px 0;
                  }
                  .email-editor h2 {
                    color: #1f2937;
                    font-size: 18px;
                    font-weight: 600;
                    margin: 24px 0 16px 0;
                  }
                  .email-editor p {
                    margin: 0 0 16px 0;
                  }
                  .email-editor .details-box {
                    background-color: #f9fafb;
                    border-left: 3px solid #6b7280;
                    padding: 20px;
                    margin: 24px 0;
                    border-radius: 4px;
                  }
                  .email-editor .details-box h2 {
                    font-size: 14px;
                    font-weight: 600;
                    color: #6b7280;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 16px 0;
                  }
                  .email-editor .detail-row {
                    display: block;
                    margin-bottom: 12px;
                  }
                  .email-editor .detail-label {
                    color: #6b7280;
                    font-size: 13px;
                    display: block;
                    margin-bottom: 2px;
                  }
                  .email-editor .detail-value {
                    color: #1f2937;
                    font-weight: 500;
                  }
                  .email-editor .btn {
                    display: inline-block;
                    background-color: #ffd000;
                    color: #1f2937;
                    text-decoration: none;
                    padding: 12px 28px;
                    border-radius: 6px;
                    font-weight: 500;
                    font-size: 14px;
                    margin: 8px 8px 8px 0;
                    cursor: pointer;
                  }
                  .email-editor .btn-outline {
                    background-color: transparent;
                    border: 1px solid #d1d5db;
                    color: #374151;
                  }
                  .email-editor .note {
                    background-color: #fef3c7;
                    border-radius: 6px;
                    padding: 16px;
                    margin: 24px 0;
                    font-size: 14px;
                  }
                  .email-editor .note strong {
                    color: #92400e;
                  }
                  .email-editor .info-box {
                    background-color: #dbeafe;
                    border-radius: 6px;
                    padding: 16px;
                    margin: 24px 0;
                    font-size: 14px;
                  }
                  .email-editor .info-box strong {
                    color: #1e40af;
                  }
                  .email-editor .success-box {
                    background-color: #d1fae5;
                    border-radius: 6px;
                    padding: 16px;
                    margin: 24px 0;
                    font-size: 14px;
                  }
                  .email-editor .success-box strong {
                    color: #065f46;
                  }
                  .email-editor .divider,
                  .email-editor hr {
                    border: none;
                    border-top: 1px solid #e5e7eb;
                    margin: 32px 0;
                  }
                  .email-editor .footer {
                    color: #6b7280;
                    font-size: 13px;
                    text-align: center;
                  }
                  .email-editor .footer a {
                    color: #075985;
                    text-decoration: none;
                  }
                  .email-editor a {
                    color: #075985;
                  }
                  .email-editor .logo {
                    text-align: center;
                    margin-bottom: 32px;
                  }
                  .email-editor .logo img {
                    max-width: 200px;
                    height: auto;
                  }
                  .email-editor table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                  }
                  .email-editor table th {
                    background-color: #f3f4f6;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    color: #374151;
                    border-bottom: 2px solid #e5e7eb;
                  }
                  .email-editor table td {
                    padding: 12px;
                    border-bottom: 1px solid #e5e7eb;
                  }
                  /* Style merge tags to be visible but distinct */
                  .email-editor code {
                    background-color: #f3f4f6;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    color: #059669;
                    border: 1px dashed #d1d5db;
                  }
                `}</style>
                
                <div
                  ref={editorRef}
                  contentEditable={!isViewMode}
                  onInput={updateContent}
                  onBlur={updateContent}
                  onFocus={handleEditorFocus}
                  suppressContentEditableWarning={true}
                  className="email-editor p-4 sm:p-6 md:p-8 min-h-[400px] sm:min-h-[500px] focus:outline-none"
                  dir="ltr"
                  data-placeholder="Start writing your email template here..."
                />
              </div>
            </div>
          )}

          {/* Preview View */}
          {viewMode === 'preview' && (
            <div className="bg-gray-50 p-3 sm:p-4 md:p-6 flex-1 w-full overflow-auto">
              <div className="max-w-4xl mx-auto">
                <div className="bg-gray-100 rounded-lg p-3 sm:p-4 md:p-6 mb-4 md:mb-6">
                  <div className="bg-white rounded shadow-sm p-3 sm:p-4 mb-2">
                    <p className="text-xs sm:text-sm text-gray-600 mb-1"><strong>Subject:</strong></p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900 break-words">{subject || 'No subject'}</p>
                  </div>
                </div>
                
                {/* Use iframe for full HTML documents to properly render styles */}
                {htmlWrapper ? (
                  <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
                    <iframe
                      srcDoc={getPreviewContent()}
                      title="Email Preview"
                      className="w-full min-h-[500px] border-0"
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4 sm:p-6 md:p-8">
                    <div 
                      dangerouslySetInnerHTML={{ __html: getPreviewContent() }}
                      style={{ 
                        fontFamily: 'Arial, Helvetica, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: '#333'
                      }}
                    />
                  </div>
                )}
                
                <div className="mt-4 md:mt-6 text-center text-xs sm:text-sm text-gray-500">
                  <Info className="w-4 h-4 inline mr-1" />
                  This is how your email will appear to recipients
                </div>
              </div>
            </div>
          )}

          {/* Code View */}
          {viewMode === 'code' && (
            <div className="p-3 sm:p-4 bg-gray-50 flex-1 w-full overflow-auto">
              <div className="max-w-4xl mx-auto">
                <textarea
                  value={content}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="w-full h-[400px] sm:h-[500px] md:h-[600px] p-3 sm:p-4 font-mono text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                  placeholder="HTML code will appear here..."
                  disabled={isViewMode}
                  style={{ fontFamily: 'Monaco, Courier, monospace' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Helper Menu Modal */}
      {showHelperMenu && selectedMergeTag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                  Insert: {selectedMergeTag.label}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 font-mono break-all">{selectedMergeTag.value}</p>
              </div>
              <button
                onClick={() => setShowHelperMenu(false)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => insertSimpleMergeTag(selectedMergeTag)}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900">Simple Insert</div>
                <div className="text-xs text-gray-500 mt-1 font-mono break-all">
                  Insert as: {selectedMergeTag.value}
                </div>
              </button>

              <button
                onClick={() => insertList(selectedMergeTag.value.replace(/{{|}}/g, ''))}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900 flex items-center">
                  <List className="w-4 h-4 mr-2" />
                  Insert as Bullet List
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Display array items as a formatted list
                </div>
              </button>

              <button
                onClick={() => insertTable(selectedMergeTag.value.replace(/{{|}}/g, ''))}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Insert as Table
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Display array of objects as a table
                </div>
              </button>

              <button
                onClick={() => insertConditional(selectedMergeTag.value.replace(/{{|}}/g, ''))}
                className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12m-12 5h12M3 7h.01M3 12h.01M3 17h.01" />
                  </svg>
                  Insert with Conditional
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Show only when data exists
                </div>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                💡 Tip: Edit in Code View for full customization
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer - Responsive */}
      <div className="px-4 md:px-6 py-3 bg-gray-50 border-t border-gray-200 flex-shrink-0">
        <p className="text-xs text-gray-600 flex items-start">
          <Info className="w-3 h-3 mr-1.5 flex-shrink-0 mt-0.5" />
          <span>
            {viewMode === 'editor' && (htmlWrapper 
              ? 'Editing body content only. Use HTML view to modify styles and head content.'
              : 'Use the toolbar to format text and click merge tag buttons to insert dynamic content.'
            )}
            {viewMode === 'preview' && 'Preview shows how your email will look. Merge tags will be replaced with actual data when sent.'}
            {viewMode === 'code' && 'Edit the raw HTML code. Changes will be reflected in the editor view.'}
          </span>
        </p>
      </div>

      {/* Hyphenated Tags Warning Dialog */}
      {showSaveConfirmDialog && hyphenatedTagsValidation && (
        <ConfirmDialog
          isOpen={showSaveConfirmDialog}
          onClose={handleCancelSave}
          onConfirm={handleConfirmSaveWithHyphens}
          title="Hyphenated Merge Tags Detected"
          message={
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                This template contains <strong>{hyphenatedTagsValidation.count}</strong> hyphenated merge tag(s):
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                <ul className="space-y-1 text-sm font-mono">
                  {hyphenatedTagsValidation.hyphenatedTags.slice(0, 10).map((tag, idx) => (
                    <li key={idx} className="text-yellow-800">• {tag}</li>
                  ))}
                  {hyphenatedTagsValidation.hyphenatedTags.length > 10 && (
                    <li className="text-yellow-600 italic">
                      ... and {hyphenatedTagsValidation.hyphenatedTags.length - 10} more
                    </li>
                  )}
                </ul>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800 flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    These will be auto-converted at send-time, but it&apos;s recommended to use underscores instead (e.g., <code className="px-1 py-0.5 bg-blue-100 rounded">my_tag_name</code>).
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-purple-900">Want to fix them now?</p>
                  <p className="text-xs text-purple-700 mt-0.5">Click &quot;Cancel&quot; and use the &quot;Fix Tags&quot; button to auto-convert all hyphenated tags to underscores.</p>
                </div>
              </div>
            </div>
          }
          confirmText="Save Anyway"
          confirmColor="primary"
          cancelText="Cancel"
        />
      )}

      {/* Helper Documentation Modal */}
      {showHelperModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowHelperModal(false)}
            />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
              <div className="bg-gray-50 px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">
                  Template Helper Guide
                </h3>
                <button
                  onClick={() => setShowHelperModal(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="bg-white px-4 sm:px-6 py-4 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto">
                <TemplateHelperDocumentation />
              </div>

              <div className="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowHelperModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTemplateBuilder;