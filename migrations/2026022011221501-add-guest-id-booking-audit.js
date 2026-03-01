'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add guest_id column
    await queryInterface.addColumn('booking_audit_logs', 'guest_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'guests',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      after: 'user_id' // MySQL specific - places column after user_id
    });

    // Add index for better query performance
    await queryInterface.addIndex('booking_audit_logs', ['guest_id'], {
      name: 'idx_booking_audit_logs_guest_id'
    });

    console.log('✅ Added guest_id column to booking_audit_logs');
    console.log('✅ Added index on guest_id');
  },

  async down(queryInterface, Sequelize) {
    // Remove index
    await queryInterface.removeIndex('booking_audit_logs', 'idx_booking_audit_logs_guest_id');
    
    // Remove column
    await queryInterface.removeColumn('booking_audit_logs', 'guest_id');
    
    console.log('✅ Removed guest_id column from booking_audit_logs');
  }
};