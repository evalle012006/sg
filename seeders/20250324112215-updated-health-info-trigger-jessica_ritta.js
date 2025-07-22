'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await Promise.all([
      queryInterface.bulkUpdate('email_triggers',
        { enabled: false },
        { email_template: 'internal-recipient-health-info' }
      ),
    ]);

    await queryInterface.bulkInsert('email_triggers', [{
      trigger_questions: JSON.stringify([
        {
          question: "Do any of the following relate to you?",
          answer: ["Pressure Injuries", "Current Open Wounds", "Recent admission to hospital", "Recent surgery", "Anaphalaxis", "Diabetes", "Epilepsy", "I currently require subcutaneous injections"]
        },
        {
          question: "Are you currently an inpatient at a hospital or a rehabilitation facility?",
          answer: "Yes"
        },
        {
          question: "Is there anything about your mental health that you would like to tell us so we can better support you during your stay?",
          answer: "Yes"
        },
        {
          question: "Do you have difficulty swallowing?",
          answer: "Yes"
        }
      ]),
      email_template: 'internal-recipient-health-info',
      type: 'internal',
      enabled: true,
      recipient: 'Jessica.allen@sargoodoncollaroy.com.au'
    },
    {
      trigger_questions: JSON.stringify([
        {
          question: "Do any of the following relate to you?",
          answer: ["Pressure Injuries", "Current Open Wounds", "Recent admission to hospital", "Recent surgery", "Mental Health", "Anaphalaxis", "Diabetes", "Epilepsy"]
        },
        {
          question: "Is there anything about your mental health that you would like to tell us so we can better support you during your stay?",
          answer: "Yes"
        },
        {
          question: "Do you have difficulty swallowing?",
          answer: "Yes"
        }
      ]),
      email_template: 'internal-recipient-health-info',
      type: 'internal',
      enabled: true,
      recipient: 'Rita.Cusmiani@sargoodoncollaroy.com.au'
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
