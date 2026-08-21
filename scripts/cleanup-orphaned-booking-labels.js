// scripts/cleanup-orphaned-booking-labels.js
// Usage:
//   node scripts/cleanup-orphaned-booking-labels.js            (dry run, no writes)
//   node scripts/cleanup-orphaned-booking-labels.js --apply    (writes changes)
//
// NOTE: audit logging intentionally omitted here — this script performs a
// bulk mutation of bookings.label with no per-booking audit trail. If this
// is ever run against production, capture a DB snapshot/export of affected
// booking IDs + before/after values (the console output below) and keep it
// somewhere retrievable, since there will be no record in booking_audit_logs.

const { Booking, Flag, sequelize } = require('../models');
const { Op } = require('sequelize');

const APPLY = process.argv.includes('--apply');

async function main() {
  const validFlags = await Flag.findAll({
    where: { type: 'booking' },
    attributes: ['value'],
  });
  const validValues = new Set(validFlags.map(f => f.value));

  const bookings = await Booking.findAll({
    attributes: ['id', 'label'],
    where: { label: { [Op.not]: null } },
  });

  const affected = bookings
    .map(b => {
      const current = Array.isArray(b.label) ? b.label : [];
      const orphaned = current.filter(v => !validValues.has(v));
      return { booking: b, current, orphaned };
    })
    .filter(x => x.orphaned.length > 0);

  console.log(`Scanned ${bookings.length} bookings with a label array.`);
  console.log(`Found ${affected.length} bookings with orphaned label value(s).\n`);

  for (const { booking, current, orphaned } of affected) {
    const cleaned = current.filter(v => !orphaned.includes(v));
    console.log(`Booking ${booking.id}: removing [${orphaned.join(', ')}]  ->  [${cleaned.join(', ')}]`);
  }

  if (!APPLY) {
    console.log(`\nDry run only — no changes written. Re-run with --apply to write these changes.`);
    return;
  }

  console.log(`\nApplying changes...`);

  let successCount = 0;
  let failCount = 0;

  for (const { booking, orphaned } of affected) {
    const transaction = await sequelize.transaction();
    try {
      for (const value of orphaned) {
        await sequelize.query(
          `UPDATE bookings
           SET label = JSON_REMOVE(label, JSON_UNQUOTE(JSON_SEARCH(label, 'one', :value)))
           WHERE id = :id AND JSON_CONTAINS(label, :quotedValue)`,
          {
            replacements: { value, quotedValue: JSON.stringify(value), id: booking.id },
            transaction,
          }
        );
      }

      await transaction.commit();
      successCount++;
    } catch (err) {
      await transaction.rollback();
      console.error(`FAILED booking ${booking.id}:`, err.message);
      failCount++;
    }
  }

  console.log(`\nDone. ${successCount} bookings updated, ${failCount} failed.`);
  process.exit(failCount > 0 ? 1 : 0);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });