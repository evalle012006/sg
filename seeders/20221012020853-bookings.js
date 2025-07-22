'use strict';

const { faker } = require('@faker-js/faker');

module.exports = {
  async up(queryInterface, Sequelize) {

    const bookings = []

    const bookingStatuses = await queryInterface.sequelize.query('SELECT * FROM settings WHERE attribute = "booking_status"');
    const eligibilityStatuses = await queryInterface.sequelize.query('SELECT * FROM settings WHERE attribute = "booking_eligibility"');

    for (let i = 0; i < 20; i++) {
      let arrival_date = faker.date.future();
      let departure_date = faker.date.future(0.10, arrival_date);

      bookings.push({
        uuid: faker.datatype.uuid(),
        guest_id: faker.datatype.number({ min: 1, max: 25 }),
        type: faker.helpers.arrayElement(['First Time Guest', 'Returning Guest']),
        type_of_spinal_injury: faker.helpers.arrayElement(['Cervical', 'Thoracic', 'Lumbar', 'Sacral']),
        eligibility: faker.helpers.arrayElement(eligibilityStatuses[0].map(status => status.value)),
        status: faker.helpers.arrayElement(bookingStatuses[0].map(status => status.value)),
        alternate_contact_name: faker.name.fullName(),
        alternate_contact_number: faker.phone.number(),
        preferred_arrival_date: arrival_date,
        preferred_departure_date: departure_date,
        complete: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
    }
    await queryInterface.bulkInsert('bookings', bookings, {});

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
