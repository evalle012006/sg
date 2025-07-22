'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('email_triggers', [{
      trigger_questions: JSON.stringify([{
        question: "Would you like to apply for assistance for the costs associated with travel to and from Sargood on Collaroy?",
        answer: "Yes"
      }, {
        question: "How will your stay be funded?",
        answer: "Applying for financial assistance through the Sargood Foundation"
      }]),
      email_template: 'internal-recipient-new-booking',
      type: 'internal',
      enabled: true,
      recipient: 'jessica.allen@sargoodoncollaroy.com.au'
    },{
      trigger_questions: JSON.stringify([{
        question: "Do any of the following relate to you?",
        answer: ["Pressure Injuries", 
                  "Current Open Wounds", 
                  "Recent admission to hospital", 
                  "Recent surgery", 
                  "Anaphalaxis",
                  "Diabetes", 
                  "Epilepsy",
                  "I currently require subcutaneous injections"
                ]
      }]),
      email_template: 'internal-recipient-health-info',
      type: 'internal',
      recipient: "Jessica.allen@sargoodoncollaroy.com.au"
    },{
      trigger_questions: JSON.stringify([{
        question: "Are you currently an inpatient at a hospital or a rehabilitation facility?",
        answer: "Yes"
      }]),
      email_template: 'internal-recipient-health-info',
      type: 'internal',
      recipient: "Jessica.allen@sargoodoncollaroy.com.au"
    },{
      trigger_questions: JSON.stringify([{
        question: "Is there anything about your mental health that you would like to tell us so we can better support you during your stay?",
        answer: "Yes"
      }]),
      email_template: 'internal-recipient-health-info',
      type: 'internal',
      recipient: "Rita.Cusmiani@sargoodoncollaroy.com.au"
    },{
      trigger_questions: JSON.stringify([{
        question: "Is there anything about your mental health that you would like to tell us so we can better support you during your stay?",
        answer: "Yes"
      }]),
      email_template: 'internal-recipient-health-info',
      type: 'internal',
      recipient: "Jessica.allen@sargoodoncollaroy.com.au"
    },{
      trigger_questions: JSON.stringify([{
        question: "Do you have difficulty swallowing?",
        answer: "Yes"
      }]),
      email_template: 'internal-recipient-health-info',
      type: 'internal',
      recipient: "Jessica.allen@sargoodoncollaroy.com.au"
    },{
      trigger_questions: JSON.stringify([{
        question: "Do you have difficulty swallowing?",
        answer: "Yes"
      }]),
      email_template: 'internal-recipient-health-info',
      type: 'internal',
      recipient: "Rita.Cusmiani@sargoodoncollaroy.com.au"
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
