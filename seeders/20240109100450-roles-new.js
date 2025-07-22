'use strict';

const { faker } = require('@faker-js/faker')

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.bulkInsert('roles', [
      {
        name: 'Reception',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        name: 'Read Only',
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
