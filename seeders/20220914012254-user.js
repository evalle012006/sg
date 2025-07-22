'use strict';
const { faker } = require('@faker-js/faker');
const bcryptjs = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    let users = [];
    const salt = await bcryptjs.genSalt(10);

    for (let index = 0; index < 10; index++) {
      users.push({
        uuid: faker.datatype.uuid(),
        first_name: faker.name.firstName(),
        last_name: faker.name.lastName(),
        email: faker.internet.email(),
        phone_number: faker.phone.number('+61-###-###-###'),
        email_verified: faker.datatype.boolean(),
        password: await bcryptjs.hash('Collaroy@2097', salt),
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      })

    }

    users.push({
      uuid: faker.datatype.uuid(),
      first_name: 'Administrator',
      last_name: 'User',
      email: 'admin@sargoodoncollaroy.com.au',
      phone_number: faker.phone.number('+61-###-###-###'),
      email_verified: faker.datatype.boolean(),
      password: await bcryptjs.hash('Collaroy@2097', salt),
      created_at: faker.datatype.datetime(),
      updated_at: faker.datatype.datetime(),
    });

    // users.push({
    //   first_name: 'Alex',
    //   last_name: 'Burton',
    //   email: 'alex@castledigital.com.au',
    //   phone_number: faker.phone.number('+61-###-###-###'),
    //   email_verified: faker.datatype.boolean(),
    //   password: await bcryptjs.hash('Collaroy@2097', salt),
    //   created_at: faker.datatype.datetime(),
    //   updated_at: faker.datatype.datetime(),
    // });

    // users.push({
    //   first_name: 'Mark',
    //   last_name: 'Elliott',
    //   email: 'mark@castledigital.com.au',
    //   phone_number: faker.phone.number('+61-###-###-###'),
    //   email_verified: faker.datatype.boolean(),
    //   password: await bcryptjs.hash('Collaroy@2097', salt),
    //   created_at: faker.datatype.datetime(),
    //   updated_at: faker.datatype.datetime(),
    // });

    // users.push({
    //   first_name: 'Rolando',
    //   last_name: 'Evalle',
    //   email: 'rolando@castledigital.com.au',
    //   phone_number: faker.phone.number('+61-###-###-###'),
    //   email_verified: faker.datatype.boolean(),
    //   password: await bcryptjs.hash('Collaroy@2097', salt),
    //   created_at: faker.datatype.datetime(),
    //   updated_at: faker.datatype.datetime(),
    // });

    // users.push({
    //   first_name: 'Salman',
    //   last_name: 'Saleem',
    //   email: 'salman@castledigital.com.au',
    //   phone_number: faker.phone.number('+61-###-###-###'),
    //   email_verified: faker.datatype.boolean(),
    //   password: await bcryptjs.hash('Collaroy@2097', salt),
    //   created_at: faker.datatype.datetime(),
    //   updated_at: faker.datatype.datetime(),
    // });


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
