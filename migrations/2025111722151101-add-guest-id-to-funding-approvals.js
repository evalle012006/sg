'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add guest_id column to funding_approvals
    await queryInterface.addColumn('funding_approvals', 'guest_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Allow null temporarily for existing records
      references: {
        model: 'guests',
        key: 'id'
      },
      onDelete: 'CASCADE'
    });

    // Add index for performance
    await queryInterface.addIndex('funding_approvals', ['guest_id']);

    // If you have existing funding approvals, you might want to delete them or assign them
    // For now, we'll just allow null
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('funding_approvals', 'guest_id');
  }
};