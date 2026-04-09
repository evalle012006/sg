import React from 'react';

// ─── Field label maps ────────────────────────────────────────────────────────

const ICARE_FIELD_LABELS = {
    'icare-participant-number':                             'Participant Number',
    'name-of-insurer':                                     'Name of Insurer',
    'email-address-of-insurer-where-invoice-will-be-sent': 'Insurer Email (Invoice)',
    'phone-number-of-insurer':                             'Insurer Phone Number',
    'billing-address-of-insurer':                          'Billing Address',
    'billing-address-line-2':                              'Billing Address Line 2',
    'city':                                                'City',
    'state':                                               'State',
    'postal-code':                                         'Postal Code',
    'icare-coordinator-first-name':                        'Coordinator First Name',
    'icare-coordinator-last-name':                         'Coordinator Last Name',
    'icare-coordinator-contact-number':                    'Coordinator Contact Number',
    'icare-coordinator-email-address':                     'Coordinator Email',
    'icare-case-managers-first-name':                      'Case Manager First Name',
    'icare-case-managers-last-name':                       'Case Manager Last Name',
    'icare-case-managers-email-address':                   'Case Manager Email',
};

const NDIS_FIELD_LABELS = {
    'please-select-from-one-of-the-following-ndis-funding-options': 'NDIS Funding Type',
    'ndis-ndia-participant-number':                        'NDIS/NDIA Participant Number',
    'your-ndis-ndia-plan-date-range':                      'NDIS/NDIA Plan Date Range',
    'ndis-ndia-support-coordinator-first-name':            'Support Coordinator First Name',
    'ndis-ndia-support-coordinator-last-name':             'Support Coordinator Last Name',
    'ndis-ndia-support-coordinator-email-address':         'Support Coordinator Email',
    'ndis-ndia-support-coordinator-contact-number':        'Support Coordinator Phone',
    'ndis-participant-number':                             'NDIS Participant Number',
    'your-ndis-plan-date-range':                           'NDIS Plan Date Range',
};

// ─── Display groups ──────────────────────────────────────────────────────────

const ICARE_FIELD_GROUPS = [
    {
        title: 'Participant',
        keys:  ['icare-participant-number'],
    },
    {
        title: 'Insurer Details',
        keys:  [
            'name-of-insurer',
            'email-address-of-insurer-where-invoice-will-be-sent',
            'phone-number-of-insurer',
            'billing-address-of-insurer',
            'billing-address-line-2',
            'city',
            'state',
            'postal-code',
        ],
    },
    {
        title: 'iCare Coordinator',
        keys:  [
            'icare-coordinator-first-name',
            'icare-coordinator-last-name',
            'icare-coordinator-contact-number',
            'icare-coordinator-email-address',
        ],
    },
    {
        title: 'Case Manager',
        keys:  [
            'icare-case-managers-first-name',
            'icare-case-managers-last-name',
            'icare-case-managers-email-address',
        ],
    },
];

const NDIS_FIELD_GROUPS = [
    {
        title: 'Funding Type',
        keys:  ['please-select-from-one-of-the-following-ndis-funding-options'],
    },
    {
        title: 'NDIS/NDIA Details',
        keys:  ['ndis-ndia-participant-number', 'your-ndis-ndia-plan-date-range'],
    },
    {
        title: 'Support Coordinator',
        keys:  [
            'ndis-ndia-support-coordinator-first-name',
            'ndis-ndia-support-coordinator-last-name',
            'ndis-ndia-support-coordinator-email-address',
            'ndis-ndia-support-coordinator-contact-number',
        ],
    },
    {
        title: 'Self-Managed Details',
        keys:  ['ndis-participant-number', 'your-ndis-plan-date-range'],
    },
];

// ─── Sub-component ───────────────────────────────────────────────────────────

const FieldGroup = ({ title, keys, data, labels }) => {
    // Only render the group if at least one field has a value
    const hasData = keys.some(k => data[k]);
    if (!hasData) return null;

    return (
        <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {title}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {keys.map(key => {
                    const value = data[key];
                    if (!value) return null;
                    return (
                        <div key={key}>
                            <p className="text-xs text-gray-500">{labels[key]}</p>
                            <p className="text-sm font-medium text-gray-800 mt-0.5 break-words">{value}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * FundingProfileSection
 *
 * Read-only display of a guest's stored iCare / NDIS funding details,
 * synced from their last confirmed booking of that funder type.
 *
 * @param {{ icare: { funding_data, updated_at } | null, ndis: {...} | null }} fundingProfiles
 */
export default function FundingProfileSection({ fundingProfiles }) {
    if (!fundingProfiles) return null;

    const { icare, ndis } = fundingProfiles;

    if (!icare && !ndis) return null;

    return (
        <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-base sm:text-lg font-semibold text-gray-700 uppercase">
                    Funding Information
                </h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">
                Synced automatically when an iCare or NDIS booking is confirmed.
            </p>

            {/* ── iCare ─────────────────────────────────────────────────── */}
            {icare && (
                <div className="mb-5 bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">
                            iCare
                        </span>
                        {icare.updated_at && (
                            <span className="text-xs text-gray-400">
                                Last updated: {new Date(icare.updated_at).toLocaleDateString('en-AU', {
                                    day: 'numeric', month: 'short', year: 'numeric'
                                })}
                            </span>
                        )}
                    </div>
                    {ICARE_FIELD_GROUPS.map(group => (
                        <FieldGroup
                            key={group.title}
                            title={group.title}
                            keys={group.keys}
                            data={icare.funding_data || {}}
                            labels={ICARE_FIELD_LABELS}
                        />
                    ))}
                </div>
            )}

            {/* ── NDIS ──────────────────────────────────────────────────── */}
            {ndis && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                            NDIS
                        </span>
                        {ndis.updated_at && (
                            <span className="text-xs text-gray-400">
                                Last updated: {new Date(ndis.updated_at).toLocaleDateString('en-AU', {
                                    day: 'numeric', month: 'short', year: 'numeric'
                                })}
                            </span>
                        )}
                    </div>
                    {NDIS_FIELD_GROUPS.map(group => (
                        <FieldGroup
                            key={group.title}
                            title={group.title}
                            keys={group.keys}
                            data={ndis.funding_data || {}}
                            labels={NDIS_FIELD_LABELS}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}