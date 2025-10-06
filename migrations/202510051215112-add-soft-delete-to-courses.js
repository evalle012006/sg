'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add deleted_at column for soft delete
    await queryInterface.addColumn('courses', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
      comment: 'Timestamp when course was soft deleted'
    });

    // Add index for better query performance
    await queryInterface.addIndex('courses', ['deleted_at'], {
      name: 'courses_deleted_at_idx'
    });

    console.log('✅ Added deleted_at column to courses table');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('courses', 'courses_deleted_at_idx');
    await queryInterface.removeColumn('courses', 'deleted_at');
    console.log('✅ Removed deleted_at column from courses table');
  }
};