'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add status column to course_offers table
    await queryInterface.addColumn('course_offers', 'status', {
      type: Sequelize.ENUM('offered', 'accepted', 'completed'),
      allowNull: false,
      defaultValue: 'offered',
      after: 'offered_by' // Position after offered_by column
    });

    // Add index for better performance when filtering by status
    await queryInterface.addIndex('course_offers', ['status'], {
      name: 'course_offers_status_idx'
    });

    // Update existing records to 'offered' status (they're already created offers)
    await queryInterface.sequelize.query(
      "UPDATE course_offers SET status = 'offered'"
    );
  },

  async down(queryInterface, Sequelize) {
    // Remove the index first
    await queryInterface.removeIndex('course_offers', 'course_offers_status_idx');
    
    // Remove the status column
    await queryInterface.removeColumn('course_offers', 'status');
    
    // Drop the ENUM type (PostgreSQL specific - adjust if using different DB)
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_course_offers_status";');
  }
};