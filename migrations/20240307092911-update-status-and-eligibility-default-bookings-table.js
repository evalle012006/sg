'use strict';

const { json } = require("sequelize");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('bookings', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: JSON.stringify({ name: "pending_approval", label: "Pending Approval", color: "amber" })
    });

    await queryInterface.changeColumn('bookings', 'eligibility', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: JSON.stringify({ name: "pending_eligibility", label: "Pending Eligibility", color: "amber" })
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('bookings', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: JSON.stringify({ name: 'enquiry', label: 'Enquiry', color: 'gray' })
    });

    await queryInterface.changeColumn('bookings', 'eligibility', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: JSON.stringify({ name: 'pending_approval', label: 'Pending Approval', color: 'yellow' })
    });
  }
};