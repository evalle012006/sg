'use strict';

const { faker } = require('@faker-js/faker');

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.bulkInsert('settings', [
    {
      attribute: 'booking_status',
      value: JSON.stringify({ name: 'booking_canceled', label: 'Booking Cancelled', color: 'red' }),
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
