'use strict';

const { faker } = require('@faker-js/faker')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('role_has_permissions', [
      {
        role_id: 1,
        permission_id: 2,
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        role_id: 2,
        permission_id: 6,
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        role_id: 1,
        permission_id: 3,
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        role_id: 2,
        permission_id: 5,
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        role_id: 1,
        permission_id: 1,
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        role_id: 2,
        permission_id: 4,
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
