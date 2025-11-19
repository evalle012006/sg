'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add nights_used column
    await queryInterface.addColumn('funding_approvals', 'nights_used', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      after: 'nights_approved' // Optional: places column after nights_approved
    });

    // Add additional_room_nights_used column
    await queryInterface.addColumn('funding_approvals', 'additional_room_nights_used', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: true,
      after: 'additional_room_nights_approved' // Optional: places column after additional_room_nights_approved
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('funding_approvals', 'nights_used');
    await queryInterface.removeColumn('funding_approvals', 'additional_room_nights_used');
  }
};