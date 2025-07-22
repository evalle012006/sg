'use strict';
const { faker } = require('@faker-js/faker');
const bcryptjs = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {

    let guests = [];
    const salt = await bcryptjs.genSalt(10);

    for (let index = 0; index < 25; index++) {
      guests.push({
        uuid: faker.datatype.uuid(),
        first_name: faker.name.firstName(),
        last_name: faker.name.lastName(),
        phone_number: faker.phone.number(),
        email: faker.internet.email(),
        email_verified: faker.datatype.boolean(),
        password: await bcryptjs.hash('Collaroy@2097', salt),
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      })

    }
    await queryInterface.bulkInsert('guests', guests, {});

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
