'use strict';
const { faker } = require("@faker-js/faker");
const _ = require("underscore");

module.exports = {
  async up(queryInterface, Sequelize) {

    const roomTypes = await queryInterface.sequelize.query(
      `SELECT id, name from room_types;`
    );

    const bookings = await queryInterface.sequelize.query(
      `SELECT id from bookings;`
    );

    let rooms = [];

    for (let i = 0; i < 10; i++) {

      const adults = faker.datatype.number({ min: 1, max: 4 });
      const children = faker.datatype.number({ min: 0, max: 4 });
      const infants = faker.datatype.number({ min: 0, max: 4 });
      const pets = faker.datatype.number({ min: 0, max: 4 });
      const guestsTotal = adults + children + infants;

      let guests = [];
      for (let j = 0; j < guestsTotal; j++) {
        guests.push({ name: faker.name.firstName() + " " + faker.name.lastName() });
      }

      const roomType = faker.helpers.arrayElement(roomTypes[0]);
      rooms.push({
        booking_id: bookings[0][i]['id'],
        order: 1,
        room_type_id: roomType.id,
        label: roomType.name,
        checkin: faker.datatype.datetime(),
        checkout: faker.datatype.datetime(),
        arrival_time: faker.helpers.arrayElement(['6:00', '9:00', '12:00', '14:00', '18:00']),
        total_guests: guestsTotal,
        adults: adults,
        children: children,
        infants: infants,
        pets: pets,
        guests: JSON.stringify(guests),
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      });

    }

    await queryInterface.bulkInsert('rooms', rooms, {});

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
