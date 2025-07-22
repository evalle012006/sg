'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Delete existing booking_status and booking_eligibility rows
    await queryInterface.bulkDelete('settings', {
      value: JSON.stringify({"name":"awaiting_icare_approval","label":"Awaiting iCare Approval","color":"slate"})
    });

    // Insert new booking_status
    await queryInterface.bulkInsert('settings', [
      {
        attribute: 'booking_status',
        value: JSON.stringify({ name: 'on_hold', label: 'On Hold', color: 'slate' }),
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Delete new booking_status and booking_eligibility rows

    // Revert to old booking_status and booking_eligibility rows
    // Add your old values here
  }
};