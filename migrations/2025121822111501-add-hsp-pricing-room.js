'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add hsp_pricing column to room_types table
    await queryInterface.addColumn('room_types', 'hsp_pricing', {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: 0,
      after: 'peak_rate' // Place it after peak_rate column
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove hsp_pricing column from room_types table
    await queryInterface.removeColumn('room_types', 'hsp_pricing');
  }
};