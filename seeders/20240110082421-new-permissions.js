'use strict';

const { faker } = require('@faker-js/faker');

module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */

    await queryInterface.bulkInsert('permissions', [
      {
        action: 'Read',
        subject: 'Template',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Create/Edit',
        subject: 'Template',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Delete',
        subject: 'Template',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Read',
        subject: 'EmailTrigger',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Create/Edit',
        subject: 'EmailTrigger',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Create/Edit',
        subject: 'Checklist',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Delete',
        subject: 'Checklist',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Read',
        subject: 'Checklist',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Edit',
        subject: 'Checklist',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Read',
        subject: 'AdminDashboard',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Read',
        subject: 'AssetDashboard',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Read',
        subject: 'BookingDashboard',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Read',
        subject: 'Equipment',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Create/Edit',
        subject: 'Equipment',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      }, {
        action: 'Delete',
        subject: 'Equipment',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Read',
        subject: 'EquipmentCategory',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Create/Edit',
        subject: 'EquipmentCategory',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Delete',
        subject: 'EquipmentCategory',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Read',
        subject: 'EquipmentSupplier',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Create/Edit',
        subject: 'EquipmentSupplier',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Delete',
        subject: 'EquipmentSupplier',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Edit',
        subject: 'SmtpSetting',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Read',
        subject: 'Room',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Create/Edit',
        subject: 'Room',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },
      {
        action: 'Delete',
        subject: 'Room',
        created_at: faker.datatype.datetime(),
        updated_at: faker.datatype.datetime(),
      },

    ], {});
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
