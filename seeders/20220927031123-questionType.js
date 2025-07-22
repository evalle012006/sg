'use strict';

const { faker } = require('@faker-js/faker')

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.bulkInsert('question_types', [{
      name: 'string',
      type: 'string',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'text',
      type: 'text',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'multi-select',
      type: 'multi-select',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'select',
      type: 'select',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'integer',
      type: 'integer',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'date',
      type: 'date',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'date-range',
      type: 'date-range',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'time',
      type: 'time',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'info',
      type: 'info',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'checkbox',
      type: 'checkbox',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'radio',
      type: 'radio',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'email',
      type: 'email',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
    }, {
      name: 'phone-number',
      type: 'phone-number',
      created_at: faker.date.between(),
      updated_at: faker.date.between(),
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
