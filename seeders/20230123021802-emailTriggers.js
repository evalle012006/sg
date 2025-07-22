'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('email_triggers', [{
      id: 1,
      trigger_questions: JSON.stringify([{
        question: "Social Worker's Email Address"
      }]),
      email_template: 'external-recipient-new-booking',
      type: 'external',
    },
    {
      id: 2,
      trigger_questions: JSON.stringify([{
        question: "Do any of the following relate to you?",
        answer: "I currently require subcutaneous injections",
      }, {
        question: "I agree to being contacted by the Sargood Foundation to provide a testimonial about my stay?",
        answer: "Yes",
      }, {
        question: "What goals are you looking to achieve by staying at Sargood on Collaroy?",
      },
      {
        question: "Would you like to apply for assistance for the costs associated with travel to and from Sargood on Collaroy?",
        answer: "Yes",
      },
      {
        question: "Do you have difficulty swallowing?",
        answer: "Yes",
      }]),
      recipient: process.env.SARGOOD_ADMIN_EMAIL,
      email_template: 'booking-highlights',
      type: 'highlights',
    },
    {
      id: 3,
      trigger_questions: JSON.stringify([{
        question: "Which course?"
      }]),
      recipient: 'sebastian.vanveenendaal@sargoodoncollaroy.com.au',
      email_template: 'internal-recipient-new-booking',
      type: 'internal',
    }, {
      id: 4,
      trigger_questions: JSON.stringify([{
        question: "NDIS Support Coordinator Email Address"
      }]),
      email_template: 'funder-external-booking',
      type: 'external',
    },
    {
      id: 10,
      trigger_questions: JSON.stringify([{
        question: "icare Coordinator Email Address"
      }]),
      email_template: 'funder-external-booking',
      type: 'external',
    },
    {
      id: 5,
      trigger_questions: JSON.stringify([{
        question: "Plan Management Company Email Address",
      }]),
      email_template: 'funder-external-booking',
      type: 'external',
    },
    {
      id: 6,
      trigger_questions: JSON.stringify([{
        question: "Are you interested in accessing Occupational Therapy during your stay? [ included in package rate. Available Thurs - Fri, 8am - 4:30pm]",
        answer: "Yes",
      }]),
      recipient: "david.simpson@sargoodoncollaroy.com.au",
      email_template: 'internal-recipient-new-booking',
      type: 'internal',
    },
    {
      id: 7,
      trigger_questions: JSON.stringify([{
        question: "Are you interested in accessing Clinical Nurse Education (included in package rate) during your stay?",
        answer: "Yes",
      }]),
      recipient: "Rita.Cusmiani@sargoodoncollaroy.com.au",
      email_template: 'internal-recipient-new-booking',
      type: 'internal',
    },
    {
      id: 8,
      trigger_questions: JSON.stringify([{
        question: "Are you interested in accessing the Weekly Activity Program  e.g. surfing, kayaking, golf, ocean pool, cycling etc.  (Included in package rate) during your stay?",
        answer: "Yes",
      }]),
      recipient: "jacob.graham@sargoodoncollaroy.com.au",
      email_template: 'internal-recipient-new-booking',
      type: 'internal',
    },
    {
      id: 9,
      trigger_questions: JSON.stringify([{
        question: "Are you interested in accessing Physiotherapy ($193.99/hr) during your stay?  Available 8am - 5pm M-F.",
        answer: "Yes",
      }, {
        question: "Are you interested in accessing Exercise Physiology ($166.99/hr) during your stay?  Available 8am - 5pm M-F.",
        answer: "Yes",
      }]),
      recipient: "gym@sargoodoncollaroy.com.au",
      email_template: 'internal-recipient-new-booking',
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
