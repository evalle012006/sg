'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('settings', [
      {
        attribute: 'booking_flag',
        value: 'waiting_to_hear_from_guest',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'pending_ndis_sta_eligibility',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'ndis_eligiblity',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'waiting_new_guest_call',
        created_at: new Date(),
        updated_at: new Date()
      },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('settings', null, {});
  }
};