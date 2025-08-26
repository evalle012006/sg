'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add booking_id column to course_offers table
    await queryInterface.addColumn('course_offers', 'booking_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'bookings',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      after: 'guest_id' // Position after guest_id column
    });

    // Add index for better performance when querying by booking_id
    await queryInterface.addIndex('course_offers', ['booking_id'], {
      name: 'course_offers_booking_id_idx'
    });

    // Add compound index for guest_id and booking_id queries
    await queryInterface.addIndex('course_offers', ['guest_id', 'booking_id'], {
      name: 'course_offers_guest_booking_idx'
    });

    console.log('✅ Added booking_id column and indexes to course_offers table');
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('course_offers', 'course_offers_guest_booking_idx');
    await queryInterface.removeIndex('course_offers', 'course_offers_booking_id_idx');
    
    // Remove the booking_id column
    await queryInterface.removeColumn('course_offers', 'booking_id');
    
    console.log('✅ Removed booking_id column and indexes from course_offers table');
  }
};