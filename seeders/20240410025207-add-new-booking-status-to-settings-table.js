'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('settings', [{
      attribute: 'booking_status',
      value: JSON.stringify({ "name": "guest_cancelled", "label": "Guest Cancelled", "color": "orange" }),
      created_at: new Date(),
      updated_at: new Date()
    }], {});
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('settings', null, {});
  }
};