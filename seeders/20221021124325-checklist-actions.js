'use strict';

const { faker } = require('@faker-js/faker');

module.exports = {
  async up(queryInterface, Sequelize) {

    // const checklistsActions = []

    // for (let i = 0; i <= 20; i++) {
    //   checklistsActions.push({
    //     action: faker.lorem.lines(1),
    //     status: faker.datatype.number({ min: 0, max: 1 }),
    //     checklist_id: faker.datatype.number({ min: 1, max: 5 }),
    //     created_at: new Date(),
    //     updated_at: new Date(),
    //   })
    // }
    // await queryInterface.bulkInsert('checklist_actions', checklistsActions, {});

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
