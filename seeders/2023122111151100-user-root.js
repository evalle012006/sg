'use strict';
const { faker } = require('@faker-js/faker');
const bcryptjs = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    let users = [];
    const salt = await bcryptjs.genSalt(10);

    users.push({
      uuid: faker.datatype.uuid(),
      first_name: 'Castle',
      last_name: 'Admin',
      email: 'developers@castledigital.com.au',
      phone_number: faker.phone.number('+61-###-###-###'),
      email_verified: true,
      password: await bcryptjs.hash('Collaroy@2097', salt),
      root: true,
      created_at: faker.datatype.datetime(),
      updated_at: faker.datatype.datetime()
    })

    await queryInterface.bulkInsert('users', users, {});

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
