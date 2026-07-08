'use strict';

/**
 * Creates a dedicated `flags` table to replace the generic Setting rows
 * (attribute: 'guest_flag' | 'booking_flag') as the source of truth for
 * flag metadata — adds label, acronym, and color so Manage Flags can
 * fully configure a flag instead of just its slug.
 *
 * `value` is preserved as the stable identifier (matches existing slugs
 * like 'banned', 'complex-care') because it's referenced elsewhere:
 *   - Guest.flags (JSON array of slug strings)
 *   - Booking.label (JSON array of slug strings)
 *   - EmailTrigger.guest_flag_filter / booking_flag_filter (JSON, e.g. { exclude: ['banned'] })
 * None of those are touched by this migration — only additive.
 *
 * Old Setting rows (attribute = guest_flag/booking_flag) are left in place
 * deliberately; they are not deleted here in case other code still reads
 * them. A follow-up cleanup migration can remove them once all call sites
 * are confirmed migrated.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('flags', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('guest', 'booking'),
        allowNull: false,
      },
      value: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Stable slug identifier, e.g. "complex-care". Referenced by Guest.flags, Booking.label, and EmailTrigger filters.',
      },
      label: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Human-readable display name, e.g. "Complex Care"',
      },
      acronym: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Short badge text shown in tables, e.g. "CC". Auto-suggested from label but editable.',
      },
      color: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '#6B7280',
        comment: 'Hex color, e.g. "#F59E0B". Applied via inline style, not Tailwind class names (Tailwind JIT cannot purge-safe dynamic class names from DB values).',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('flags', ['type', 'value'], {
      unique: true,
      name: 'flags_type_value_unique',
    });

    // Seed from the existing hardcoded color/acronym mappings found in
    // components/booking-comp/listv2.js, AdminGuestProfile.js, and
    // templates/exports/guest-profile.html, so existing flags keep their
    // current appearance after cutover instead of falling back to gray.
    const now = new Date();
    const seedRows = [
      // Guest flags (currently in Guest.flags JSON array)
      { type: 'guest', value: 'complex-care', label: 'Complex Care', acronym: 'CC', color: '#F59E0B' },
      { type: 'guest', value: 'banned', label: 'Banned', acronym: 'BN', color: '#EF4444' },
      { type: 'guest', value: 'outstanding-invoices', label: 'Outstanding Invoices', acronym: 'OI', color: '#C026D3' },
      { type: 'guest', value: 'specific-room-requirements', label: 'Specific Room Requirements', acronym: 'SR', color: '#0EA5E9' },
      { type: 'guest', value: 'account-credit', label: 'Account Credit', acronym: 'AC', color: '#10B981' },
      { type: 'guest', value: 'deceased', label: 'Deceased', acronym: 'DC', color: '#374151' },
      { type: 'guest', value: 'not-eligible', label: 'Not Eligible', acronym: 'NE', color: '#6B7280' },
      // Booking flags (currently in Booking.label JSON array)
      { type: 'booking', value: 'travel_grant', label: 'Travel Grant', acronym: 'TG', color: '#F59E0B' },
      { type: 'booking', value: 'foundation_stay', label: 'Foundation Stay', acronym: 'FS', color: '#8B5CF6' },
      { type: 'booking', value: 'waiting_icare_approval', label: 'Waiting iCare Approval', acronym: 'WI', color: '#D946EF' },
      { type: 'booking', value: 'waiting_icare_approval_2nd_room', label: 'Waiting iCare Approval 2nd Room', acronym: 'WI2', color: '#0EA5E9' },
      { type: 'booking', value: 'waiting_new_dates', label: 'Waiting New Dates', acronym: 'WD', color: '#334155' },
      { type: 'booking', value: 'waiting_snapform', label: 'Waiting Snapform', acronym: 'WS', color: '#EAB308' },
      { type: 'booking', value: 'waiting_icare_confirmation', label: 'Waiting iCare Confirmation', acronym: 'WC', color: '#3B82F6' },
      { type: 'booking', value: 'waiting_to_hear_from_seb', label: 'Waiting to Hear from Seb', acronym: 'WH', color: '#F97316' },
    ].map(row => ({ ...row, created_at: now, updated_at: now }));

    await queryInterface.bulkInsert('flags', seedRows);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('flags', 'flags_type_value_unique');
    await queryInterface.dropTable('flags');
    // ENUM cleanup needed on Postgres; harmless no-op on MySQL.
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_flags_type";');
    }
  },
};