'use strict';

const { faker } = require('@faker-js/faker')

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.bulkInsert('permissions', [
      {
        action: 'Read',
        subject: 'Booking',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Create/Edit',
        subject: 'Booking',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Delete',
        subject: 'Booking',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Read',
        subject: 'Guest',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Create/Edit',
        subject: 'Guest',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Delete',
        subject: 'Guest',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
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
