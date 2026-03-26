import React, { useState, useEffect, useRef } from 'react';
import { Mail, ChevronDown, X, Plus, Settings } from 'lucide-react';
import Link from 'next/link';

/**
 * Recipient Selector Component - API Integrated
 *
 * Recipient value conventions (what gets stored in DB / passed to onChange):
 *
 *   null / ''          — no recipient selected; trigger will be SKIPPED when evaluated
 *   'guest_email'      — explicitly "Guest Email"; resolves to booking guest at send time
 *   'recipient_type:info'  — Info Team (resolved from settings at send time)
 *   'recipient_type:admin' — Admin Team
 *   'recipient_type:eoi'   — EOI Team
 *   'user_email'       — Staff user's own email (user_account_created only)
 *   'alice@example.com'    — literal custom email
 *   'a@x.com, b@y.com'    — multiple custom emails (comma-separated)
 */

const RecipientSelector = ({ value, onChange, disabled = false, triggerType = 'internal' }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [emailSettings, setEmailSettings] = useState(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchEmailSettings();
  }, []);

  const fetchEmailSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch('/api/settings/email-recipients');
      if (response.ok) {
        const data = await response.json();
        setEmailSettings(data);
      } else {
        console.error('Failed to fetch email settings');
      }
    } catch (error) {
      console.error('Error fetching email settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
        setShowCustomInput(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getPredefinedRecipients = () => {
    const baseRecipients = [
      {
        // ✅ 'guest_email' sentinel — null/'' means no recipient (skip)
        value: 'guest_email',
        label: 'Guest Email',
        description: 'Send to the guest who made the booking',
        icon: '👤',
        settingKey: null
      }
    ];

    if (emailSettings) {
      if (emailSettings.email_info_recipients?.emails?.length > 0) {
        baseRecipients.push({
          value: 'recipient_type:info',
          label: 'Info Team',
          description: emailSettings.email_info_recipients.emails.join(', '),
          icon: 'ℹ️',
          settingKey: 'email_info_recipients',
          emailCount: emailSettings.email_info_recipients.emails.length
        });
      }

      if (emailSettings.email_admin_recipients?.emails?.length > 0) {
        baseRecipients.push({
          value: 'recipient_type:admin',
          label: 'Admin Team',
          description: emailSettings.email_admin_recipients.emails.join(', '),
          icon: '⚙️',
          settingKey: 'email_admin_recipients',
          emailCount: emailSettings.email_admin_recipients.emails.length
        });
      }

      if (emailSettings.email_eoi_recipients?.emails?.length > 0) {
        baseRecipients.push({
          value: 'recipient_type:eoi',
          label: 'EOI Team',
          description: emailSettings.email_eoi_recipients.emails.join(', '),
          icon: '📝',
          settingKey: 'email_eoi_recipients',
          emailCount: emailSettings.email_eoi_recipients.emails.length
        });
      }
    } else if (isLoadingSettings) {
      baseRecipients.push(
        { value: 'recipient_type:info',  label: 'Info Team',  description: 'Loading...', icon: 'ℹ️', settingKey: 'email_info_recipients' },
        { value: 'recipient_type:admin', label: 'Admin Team', description: 'Loading...', icon: '⚙️', settingKey: 'email_admin_recipients' },
        { value: 'recipient_type:eoi',   label: 'EOI Team',   description: 'Loading...', icon: '📝', settingKey: 'email_eoi_recipients' }
      );
    } else {
      baseRecipients.push({
        value: null,
        label: 'Recipient Types Not Configured',
        description: 'Go to Settings > Email Recipients to configure team emails',
        icon: '⚠️',
        isWarning: true
      });
    }

    return baseRecipients;
  };

  const predefinedRecipients = getPredefinedRecipients();

  const currentRecipients = value
    ? value.split(',').map(r => r.trim()).filter(Boolean)
    : [];

  // ✅ Guest Email is explicitly selected only when stored as 'guest_email'
  // null / '' = no recipient (trigger will skip) — does NOT show Guest Email chip
  const isGuestEmailSelected = value === 'guest_email';

  const getRecipientDisplay = (recipient) => {
    const predefined = predefinedRecipients.find(r => r.value === recipient);
    if (predefined) {
      return { label: predefined.label, icon: predefined.icon, isPredefined: true, emailCount: predefined.emailCount };
    }
    return { label: recipient, icon: '✉️', isPredefined: false };
  };

  const handleSelectRecipient = (recipient) => {
    // External triggers: single recipient only (guest email)
    if (triggerType === 'external') {
      onChange(recipient);
      setShowDropdown(false);
      return;
    }

    // Selecting Guest Email clears all others and sets sentinel value
    if (recipient === 'guest_email') {
      onChange('guest_email');
      setShowDropdown(false);
      return;
    }

    const newRecipients = [...currentRecipients];

    // Deselect if already selected
    if (newRecipients.includes(recipient)) {
      const updated = newRecipients.filter(r => r !== recipient);
      onChange(updated.length > 0 ? updated.join(', ') : null);
      return;
    }

    // Add new recipient (remove 'guest_email' if switching to team/custom)
    const withoutGuest = newRecipients.filter(r => r !== 'guest_email');
    withoutGuest.push(recipient);
    onChange(withoutGuest.join(', '));
  };

  const handleRemoveRecipient = (recipientToRemove) => {
    const updated = currentRecipients.filter(r => r !== recipientToRemove);
    onChange(updated.length > 0 ? updated.join(', ') : null);
  };

  const handleAddCustomEmail = () => {
    if (!customEmail.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customEmail.trim())) {
      alert('Please enter a valid email address');
      return;
    }

    // Remove 'guest_email' sentinel if adding a custom address
    const existing = currentRecipients.filter(r => r !== 'guest_email');
    onChange([...existing, customEmail.trim()].join(', '));
    setCustomEmail('');
    setShowCustomInput(false);
  };

  const hasSettingsRecipient = currentRecipients.some(r => r.startsWith('recipient_type:'));

  return (
    <div ref={containerRef} className="relative">
      {/* Selected Recipients Display */}
      <div
        onClick={() => !disabled && setShowDropdown(!showDropdown)}
        className={`min-h-[42px] p-2 border rounded flex items-center flex-wrap gap-2 cursor-pointer transition-colors
          ${showDropdown ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-white'}`}
      >
        {isGuestEmailSelected ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
            <span className="text-base sm:text-sm">👤</span>
            <span className="text-sm">Guest Email</span>
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
                className="hover:text-green-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : currentRecipients.length === 0 ? (
          <span className="text-gray-400 text-sm flex items-center gap-2">
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">
              {triggerType === 'external' ? 'Guest email (default)' : 'Select recipients...'}
            </span>
            <span className="sm:hidden">
              {triggerType === 'external' ? 'Guest email' : 'Select...'}
            </span>
          </span>
        ) : (
          <>
            {currentRecipients.map((recipient, idx) => {
              const display = getRecipientDisplay(recipient);
              return (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium max-w-full"
                >
                  <span className="text-base sm:text-sm flex-shrink-0">{display.icon}</span>
                  <span className="truncate">{display.label}</span>
                  {display.emailCount && (
                    <span className="text-xs text-blue-600 flex-shrink-0">({display.emailCount})</span>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemoveRecipient(recipient); }}
                      className="hover:text-blue-600 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}

        <ChevronDown
          className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${showDropdown ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Dropdown */}
      {showDropdown && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-[80vh] sm:max-h-96">
          {/* Settings Link */}
          <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
            <Link href="/settings/manage-email-recipients" target="_blank">
              <span className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-700 transition-colors cursor-pointer">
                <Settings className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">Manage Email Recipients</span>
                <span className="sm:hidden">Manage Recipients</span>
              </span>
            </Link>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {predefinedRecipients.map((recipient, idx) => {
              if (recipient.isWarning) {
                return (
                  <div key={idx} className="px-3 py-3 bg-yellow-50 border-b border-yellow-100">
                    <div className="flex items-start gap-2">
                      <span className="text-lg flex-shrink-0">{recipient.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-yellow-900">{recipient.label}</div>
                        <div className="text-xs text-yellow-700 mt-0.5 break-words">{recipient.description}</div>
                      </div>
                    </div>
                  </div>
                );
              }

              if (recipient.value === null) return null;

              const isGuestEmailOption = recipient.value === 'guest_email';
              const isSelected = isGuestEmailOption
                ? isGuestEmailSelected
                : currentRecipients.includes(recipient.value);

              // External triggers: only show Guest Email
              if (triggerType === 'external' && !isGuestEmailOption) return null;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectRecipient(recipient.value)}
                  className={`w-full text-left px-3 py-2.5 transition-colors border-b border-gray-100 last:border-b-0
                    ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  disabled={isLoadingSettings && !isGuestEmailOption}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">{recipient.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-medium text-sm ${isSelected ? 'text-blue-900' : 'text-gray-900'} truncate`}>
                          {recipient.label}
                          {recipient.emailCount && (
                            <span className="ml-1.5 text-xs font-normal text-gray-500">
                              ({recipient.emailCount} {recipient.emailCount === 1 ? 'email' : 'emails'})
                            </span>
                          )}
                        </span>
                        {isSelected && (
                          <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 block mt-0.5 break-words">{recipient.description}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Email Input (internal/system only) */}
          {triggerType !== 'external' && (
            <div className="border-t border-gray-200 bg-gray-50 p-2">
              {!showCustomInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Add Custom Email</span>
                  <span className="sm:hidden">Custom Email</span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCustomEmail()}
                    placeholder="email@example.com"
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddCustomEmail}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowCustomInput(false); setCustomEmail(''); }}
                      className="flex-1 sm:flex-none px-2 py-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <X className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500 mt-1.5">
        {triggerType === 'external'
          ? (isGuestEmailSelected
              ? '✓ Email will be sent to the guest who made the booking'
              : 'External triggers send to the guest email by default')
          : (isGuestEmailSelected ? (
              '✓ Email will be sent to the guest who made the booking'
            ) : currentRecipients.length === 0 ? (
              <>
                No recipient selected — trigger will be skipped.{' '}
                <Link href="/settings/manage-email-recipients" target="_blank" className="text-blue-600 hover:text-blue-700 underline">
                  Configure recipients →
                </Link>
              </>
            ) : hasSettingsRecipient ? (
              <>
                Recipient types configured.{' '}
                <Link href="/settings/manage-email-recipients" target="_blank" className="text-blue-600 hover:text-blue-700 underline">
                  Manage recipients →
                </Link>
              </>
            ) : (
              'Custom email recipients configured'
            ))
        }
      </p>
    </div>
  );
};

export default RecipientSelector;