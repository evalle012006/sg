'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('email_triggers', [{
      trigger_questions: JSON.stringify([{
        question: "I would like to hear about upcoming Sargood activities, events and courses",
        answer: "Yes"
      }]),
      email_template: 'internal-recipient-new-booking',
      type: 'internal',
      enabled: true,
      recipient: 'alex.richter@sargoodoncollaroy.com.au, sebastian.vanveenendaal@sargoodoncollaroy.com.au'
    },], {});
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
