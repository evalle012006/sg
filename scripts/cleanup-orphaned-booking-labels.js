// scripts/cleanup-orphaned-booking-labels.js
// Usage:
//   node scripts/cleanup-orphaned-booking-labels.js              (dry run, no writes)
//   node scripts/cleanup-orphaned-booking-labels.js --apply      (writes changes)
//
// Cleans orphaned flag values from both bookings.label and guests.flags —
// i.e. label strings that no longer correspond to a row in `flags`.
//
// NOTE: no audit logging here (bulk mutation, no per-record trail). If run
// against production, capture this script's console output (redirect to a
// log file) since it's the only record of what changed.

const { Booking, Guest, Flag, sequelize } = require('../models');
const { Op } = require('sequelize');

const APPLY = process.argv.includes('--apply');

async function cleanupTarget({ label, Model, column, flagType, validValues }) {
  const where = { [column]: { [Op.not]: null } };
  const records = await Model.findAll({ attributes: ['id', column], where });

  const affected = records
    .map(r => {
      const current = Array.isArray(r[column]) ? r[column] : [];
      const orphaned = current.filter(v => !validValues.has(v));
      return { record: r, current, orphaned };
    })
    .filter(x => x.orphaned.length > 0);

  console.log(`\n=== ${label} ===`);
  console.log(`Scanned ${records.length} rows with a non-null ${column}.`);
  console.log(`Found ${affected.length} rows with orphaned value(s).\n`);

  for (const { record, current, orphaned } of affected) {
    const cleaned = current.filter(v => !orphaned.includes(v));
    console.log(`${label} id ${record.id}: removing [${orphaned.join(', ')}]  ->  [${cleaned.join(', ')}]`);
  }

  if (!APPLY || affected.length === 0) {
    return { successCount: 0, failCount: 0 };
  }

  console.log(`\nApplying changes for ${label}...`);

  let successCount = 0;
  let failCount = 0;

  for (const { record, orphaned } of affected) {
    const transaction = await sequelize.transaction();
    try {
      for (const value of orphaned) {
        await sequelize.query(
          `UPDATE \`${Model.getTableName()}\`
           SET \`${column}\` = JSON_REMOVE(\`${column}\`, JSON_UNQUOTE(JSON_SEARCH(\`${column}\`, 'one', :value)))
           WHERE id = :id AND JSON_CONTAINS(\`${column}\`, :quotedValue)`,
          {
            replacements: { value, quotedValue: JSON.stringify(value), id: record.id },
            transaction,
          }
        );
      }
      await transaction.commit();
      successCount++;
    } catch (err) {
      await transaction.rollback();
      console.error(`FAILED ${label} id ${record.id}:`, err.message);
      failCount++;
    }
  }

  console.log(`${label}: ${successCount} updated, ${failCount} failed.`);
  return { successCount, failCount };
}

async function main() {
  const allFlags = await Flag.findAll({ attributes: ['type', 'value'] });
  const bookingValues = new Set(allFlags.filter(f => f.type === 'booking').map(f => f.value));
  const guestValues = new Set(allFlags.filter(f => f.type === 'guest').map(f => f.value));

  const bookingResult = await cleanupTarget({
    label: 'Bookings',
    Model: Booking,
    column: 'label',
    flagType: 'booking',
    validValues: bookingValues,
  });

  const guestResult = await cleanupTarget({
    label: 'Guests',
    Model: Guest,
    column: 'flags', // confirm this is the actual column name on Guest
    flagType: 'guest',
    validValues: guestValues,
  });

  if (!APPLY) {
    console.log(`\nDry run only — no changes written. Re-run with --apply to write these changes.`);
    return;
  }

  const failCount = bookingResult.failCount + guestResult.failCount;
  console.log(`\nDone. Total failures: ${failCount}.`);
  process.exit(failCount > 0 ? 1 : 0);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });