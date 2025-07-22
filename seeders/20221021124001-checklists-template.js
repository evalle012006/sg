'use strict';

const { faker } = require('@faker-js/faker');

module.exports = {
  async up(queryInterface, Sequelize) {

    const checklists = []

    for (let i = 0; i <= 5; i++) {
      checklists.push({
        name: faker.helpers.arrayElement(['Eligiblity Checklist', 'Post-Eligibility Checklist', 'Pre-Funding Approval Checklist', 'Post-Funding Approval Checklist']),
        actions: JSON.stringify(faker.helpers.arrayElements([faker.lorem.lines(1), faker.lorem.lines(1), faker.lorem.lines(1), faker.lorem.lines(1), faker.lorem.lines(1)])),
        template_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
    }

    await queryInterface.bulkInsert('checklist_templates', [...checklists, {
      id: 100,
      name: 'iCare Wellness & High Support $1300/n',
      actions: JSON.stringify([
        'Check dates are available in GC (Room Blocked if completing booking later) + Care Available in Mindbody',
        "Save jotform in Guest File + Moindbody > Guest added to Opus SMS Contacts in 'Full Guest List 3'",
        "Save vaccination evidence in guest file for guest and others coming, if not all evidence provided, label with 'waiting vacc evidence' label",
        "RETURN GUESTS in Mindbody: Emergency Contact Details. If not send jotform to complete: (Emergency Contact Details form link)",
        "UPDATE EMERGENCY CONTACT DETAILS (if applicable / delete if not needed) Receive Emergency contact details jot and add details to Mindbody. Search guest name > Client info > Update 'Emergency contact information tab with first contact' > Update 'Other custom fields' with additional emergency contact and GP details > Add medication details to 'Notes'",
        "Check guest has valid icare approval and add booking to icare",
        "Booking care in Mindbody",
        "Add booking to GC. File > Reservations > Individual > Search for guest before creating new guest > Open most recent booking > 'Copy' > Start new booking makeing sure old notes are cleared and RP number relevant to approval for this period",
        "Check rate in icare Wellness & High Support or icare Wellness and Very High Support and Approval is still valid > Add participant number and RP number to booking. Company is set to correct icare(Lifetime Care, Worker's Care or Worker's insurance) > Pay by is their bedding type and number of people staying",
        "Billing: Add where invoice needs to be sent to in Contact Email field (under marketing segment). iCare - careap@icare.nsw.gov.au | icare workers care - workers-careap@icare.nsw.gov.au | icare workers insurance - wiclaims@icare.nsw.gov.au",
        "DAVE OT: Forward 'Additional Services' email with jotform attached to david.simpson@sargodoncollaroy.com.au with OT booking signature await response for booking. Label this card 'Awaiting OT and move to 'In progress booking' list (Delete if N/A)",
        "Double check equipment is correct - if anything changes adjust in guest 'History' folio - Double check schedule in file has not missed any days. Make Trello cards to order ILS Mattress if needed",
        "Create confirmation PDF from GC and save in guest life",
        "Send confirmation email with confirmation PDF attached (+ the 'what to bring' document if it's their first stay) as email",
        "Archive Card"
      ]),
      template_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    }], {});

  //   await queryInterface.bulkInsert('checklist_actions', [{
  //     action: 'Check dates are available in GC (Room Blocked if completing booking later) + Care Available in Mindbody',
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Save jotform in Guest File + Moindbody > Guest added to Opus SMS Contacts in 'Full Guest List 3'",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Save vaccination evidence in guest file for guest and others coming, if not all evidence provided, label with 'waiting vacc evidence' label",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "RETURN GUESTS in Mindbody: Emergency Contact Details. If not send jotform to complete: (Emergency Contact Details form link)",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "UPDATE EMERGENCY CONTACT DETAILS (if applicable / delete if not needed) Receive Emergency contact details jot and add details to Mindbody. Search guest name > Client info > Update 'Emergency contact information tab with first contact' > Update 'Other custom fields' with additional emergency contact and GP details > Add medication details to 'Notes'",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Check guest has valid icare approval and add booking to icare",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Booking care in Mindbody",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Add booking to GC. File > Reservations > Individual > Search for guest before creating new guest > Open most recent booking > 'Copy' > Start new booking makeing sure old notes are cleared and RP number relevant to approval for this period",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Check rate in icare Wellness & High Support or icare Wellness and Very High Support and Approval is still valid > Add participant number and RP number to booking. Company is set to correct icare(Lifetime Care, Worker's Care or Worker's insurance) > Pay by is their bedding type and number of people staying",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Billing: Add where invoice needs to be sent to in Contact Email field (under marketing segment). iCare - careap@icare.nsw.gov.au | icare workers care - workers-careap@icare.nsw.gov.au | icare workers insurance - wiclaims@icare.nsw.gov.au",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "DAVE OT: Forward 'Additional Services' email with jotform attached to david.simpson@sargodoncollaroy.com.au with OT booking signature await response for booking. Label this card 'Awaiting OT and move to 'In progress booking' list (Delete if N/A)",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Double check equipment is correct - if anything changes adjust in guest 'History' folio - Double check schedule in file has not missed any days. Make Trello cards to order ILS Mattress if needed",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Create confirmation PDF from GC and save in guest life",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Send confirmation email with confirmation PDF attached (+ the 'what to bring' document if it's their first stay) as email",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   },
  //   {
  //     action: "Archive Card",
  //     status: false,
  //     checklist_id: 100,
  //     created_at: new Date(),
  //     updated_at: new Date(),
  //   }]);
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
