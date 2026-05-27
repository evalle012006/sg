#!/usr/bin/env node
// scripts/audit-equipment-missing-dates.js
//
// Identifies booking_equipment rows where start_date or end_date is NULL,
// joins to Booking and Guest for context, and writes a CSV report.
//
// Usage:
//   node scripts/audit-equipment-missing-dates.js
//   node scripts/audit-equipment-missing-dates.js --output ./reports/equipment-audit.csv
//   node scripts/audit-equipment-missing-dates.js --fix-from-booking  (backfills from booking model dates)
//   node scripts/audit-equipment-missing-dates.js --dry-run           (combine with --fix-from-booking)
//
// The --fix-from-booking flag attempts to backfill start_date/end_date from
// booking.preferred_arrival_date / preferred_departure_date where both are set.
// Rows where the booking also has no dates are left untouched and flagged in
// the report as "needs_manual_review".
//
// NEVER run --fix-from-booking in production without first running in --dry-run
// and reviewing the output CSV.

'use strict';

const path = require('path');
const fs   = require('fs');

// ── Bootstrap the Next.js / Sequelize environment ────────────────────────────
// Adjust the path below if the script is moved relative to the project root.
const projectRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(projectRoot, '.env.local') });

const { sequelize, Booking, BookingEquipment, Equipment, EquipmentCategory, Guest } = require(
    path.join(projectRoot, 'models')
);
const { Op } = require('sequelize');
const moment  = require('moment');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args          = process.argv.slice(2);
const outputArg     = args.indexOf('--output');
const outputPath    = outputArg !== -1 ? args[outputArg + 1] : path.join(projectRoot, `reports/equipment-missing-dates-${Date.now()}.csv`);
const fixFromBooking = args.includes('--fix-from-booking');
const dryRun         = args.includes('--dry-run');

// ── CSV helper ────────────────────────────────────────────────────────────────
function csvEscape(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function toCsvRow(fields) {
    return fields.map(csvEscape).join(',');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
    console.log('🔍 Auditing booking_equipment rows with missing dates...\n');

    if (fixFromBooking) {
        console.log(dryRun
            ? '⚠️  --fix-from-booking + --dry-run: backfill will be calculated but NOT written to DB\n'
            : '⚠️  --fix-from-booking: rows with recoverable dates WILL be updated in DB\n'
        );
    }

    // ── Query ─────────────────────────────────────────────────────────────────
    const rows = await BookingEquipment.findAll({
        where: {
            [Op.or]: [
                { start_date: null },
                { end_date: null }
            ]
        },
        include: [
            {
                model: Equipment,
                include: [{ model: EquipmentCategory }]
            },
            {
                model: Booking,
                include: [
                    {
                        model: Guest,
                        attributes: ['id', 'first_name', 'last_name', 'email']
                    }
                ],
                // Exclude hard-deleted bookings
                where: { deleted_at: null },
                required: true
            }
        ],
        order: [['created_at', 'ASC']]
    });

    console.log(`Found ${rows.length} booking_equipment row(s) with missing dates.\n`);

    if (rows.length === 0) {
        console.log('✅ No rows with missing dates. Nothing to do.');
        await sequelize.close();
        return;
    }

    // ── Process rows ──────────────────────────────────────────────────────────
    const csvHeaders = [
        'booking_equipment_id',
        'booking_id',
        'booking_uuid',
        'booking_reference',
        'booking_status',
        'guest_id',
        'guest_name',
        'guest_email',
        'equipment_id',
        'equipment_name',
        'equipment_category',
        'current_start_date',
        'current_end_date',
        'booking_arrival_date',
        'booking_departure_date',
        'created_at',
        'action',
        'backfill_start_date',
        'backfill_end_date',
        'notes'
    ];

    const csvRows  = [csvHeaders.join(',')];
    let fixedCount = 0;
    let skippedCount = 0;

    for (const row of rows) {
        const booking  = row.Booking;
        const guest    = booking?.Guest;
        const equipment = row.Equipment;

        const arrivalRaw    = booking?.preferred_arrival_date;
        const departureRaw  = booking?.preferred_departure_date;
        const arrivalFmt    = arrivalRaw   ? moment(arrivalRaw).format('YYYY-MM-DD')   : null;
        const departureFmt  = departureRaw ? moment(departureRaw).format('YYYY-MM-DD') : null;
        const canBackfill   = Boolean(arrivalFmt && departureFmt);

        let action          = 'needs_manual_review';
        let backfillStart   = '';
        let backfillEnd     = '';
        let notes           = '';

        if (fixFromBooking && canBackfill) {
            backfillStart = arrivalFmt;
            backfillEnd   = departureFmt;

            if (!dryRun) {
                try {
                    await row.update({ start_date: arrivalFmt, end_date: departureFmt });
                    action = 'backfilled';
                    fixedCount++;
                } catch (err) {
                    action = 'backfill_failed';
                    notes  = err.message;
                    skippedCount++;
                }
            } else {
                action = 'would_backfill';
            }
        } else if (fixFromBooking && !canBackfill) {
            action = 'needs_manual_review';
            notes  = 'Booking has no preferred_arrival_date or preferred_departure_date';
            skippedCount++;
        }

        csvRows.push(toCsvRow([
            row.id,
            booking?.id,
            booking?.uuid,
            booking?.reference_id,
            booking?.status_name,
            guest?.id,
            guest ? `${guest.first_name} ${guest.last_name}` : '',
            guest?.email,
            equipment?.id,
            equipment?.name,
            equipment?.EquipmentCategory?.name,
            row.start_date ? moment(row.start_date).format('YYYY-MM-DD') : '',
            row.end_date   ? moment(row.end_date).format('YYYY-MM-DD')   : '',
            arrivalFmt   || '',
            departureFmt || '',
            moment(row.created_at).format('YYYY-MM-DD HH:mm:ss'),
            action,
            backfillStart,
            backfillEnd,
            notes
        ]));
    }

    // ── Write CSV ─────────────────────────────────────────────────────────────
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf8');
    console.log(`\n📄 Report written to: ${outputPath}`);

    if (fixFromBooking && !dryRun) {
        console.log(`✅ Backfilled: ${fixedCount} row(s)`);
        console.log(`⚠️  Skipped (needs manual review): ${skippedCount} row(s)`);
    }

    await sequelize.close();
}

run().catch(err => {
    console.error('❌ Audit script failed:', err);
    process.exit(1);
});