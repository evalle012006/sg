'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('email_triggers', [{
      trigger_questions: JSON.stringify([{
        question: "Do any of the following relate to you?",
        answer: ["Pressure Injuries", 
                  "Current Open Wounds", 
                  "Recent admission to hospital", 
                  "Recent surgery", 
                  "Mental Health", 
                  "Anaphalaxis",
                  "Diabetes", 
                  "Epilepsy" 
                ]
      }]),
      email_template: 'internal-recipient-health-info',
      type: 'internal',
      recipient: "Jessica.allen@sargoodoncollaroy.com.au"
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
