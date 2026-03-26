'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 4 new filter columns to email_triggers table
    await queryInterface.addColumn('email_triggers', 'booking_status_filter', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of booking statuses to filter on (e.g., ["booking_confirmed", "in_progress"])'
    });

    await queryInterface.addColumn('email_triggers', 'booking_eligibility_filter', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Array of eligibility statuses to filter on (e.g., ["eligible"])'
    });

    await queryInterface.addColumn('email_triggers', 'guest_flag_filter', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Object with include/exclude arrays for guest flags (e.g., {"exclude": ["deceased", "banned"]})'
    });

    await queryInterface.addColumn('email_triggers', 'booking_flag_filter', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
      comment: 'Object with include/exclude arrays for booking flags (e.g., {"include": ["waiting_snapform"]})'
    });

    // Add safety filters to all guest-facing system triggers
    // This protects against emailing deceased/banned guests
    await queryInterface.sequelize.query(`
      UPDATE email_triggers 
      SET guest_flag_filter = JSON_OBJECT('exclude', JSON_ARRAY('deceased', 'banned'))
      WHERE type = 'system' 
        AND enabled = 1
        AND (recipient IS NULL OR recipient = '');
    `);

    // Add booking status + eligibility filters to critical iCare triggers
    await queryInterface.sequelize.query(`
      UPDATE email_triggers
      SET 
        booking_status_filter = JSON_ARRAY('booking_confirmed', 'in_progress'),
        booking_eligibility_filter = JSON_ARRAY('eligible')
      WHERE trigger_context = 'icare_funding_updated'
        AND JSON_EXTRACT(context_conditions, '$.update_type') = 'allocation';
    `);

    // Add eligibility filter to booking confirmed triggers
    await queryInterface.sequelize.query(`
      UPDATE email_triggers
      SET booking_eligibility_filter = JSON_ARRAY('eligible')
      WHERE trigger_context = 'booking_confirmed'
        AND type = 'system';
    `);

    // Add eligibility filter to course offers
    await queryInterface.sequelize.query(`
      UPDATE email_triggers
      SET booking_eligibility_filter = JSON_ARRAY('eligible')
      WHERE trigger_context IN ('course_offer_sent', 'course_eoi_accepted')
        AND type = 'system';
    `);

    console.log('✅ Email trigger filters added successfully');
    console.log('✅ Safety filters applied to guest-facing triggers');
    console.log('✅ Critical triggers protected');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove all filter columns
    await queryInterface.removeColumn('email_triggers', 'booking_status_filter');
    await queryInterface.removeColumn('email_triggers', 'booking_eligibility_filter');
    await queryInterface.removeColumn('email_triggers', 'guest_flag_filter');
    await queryInterface.removeColumn('email_triggers', 'booking_flag_filter');

    console.log('✅ Email trigger filters removed');
  }
};