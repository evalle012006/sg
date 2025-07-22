'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('email_triggers', [
    {
      id: 11,
      trigger_questions: JSON.stringify([]),
      recipient: "info@sargoodoncollaroy.com.au",
      email_template: 'recipient-booking-amended',
      type: 'internal',
    }], {});
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
