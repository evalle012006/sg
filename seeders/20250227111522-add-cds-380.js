'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('email_triggers', [
      {
        trigger_questions: JSON.stringify([{
          question: "How will your stay be funded?",
          answer: "Applying For Financial Assistance through the Sargood Foundation"
        }]),
        email_template: 'internal-recipient-foundation-stay',
        type: 'internal',
        enabled: true,
        recipient: 'andrew@sargood.org.au'
      },
      {
        trigger_questions: JSON.stringify([{
          question: "After reading the above terms and conditions would you like to apply for a Travel Grant?",
          answer: "Yes"
        }]),
        email_template: 'internal-recipient-foundation-stay',
        type: 'internal',
        enabled: true,
        recipient: 'andrew@sargood.org.au'
      },
    ], {});
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
