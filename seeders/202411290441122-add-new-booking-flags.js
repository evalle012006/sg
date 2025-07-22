'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('settings', [
      {
        attribute: 'booking_flag',
        value: 'travel_grant',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'foundation_stay',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'waiting_icare_approval',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'waiting_icare_approval_2nd_room',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'waiting_emergency_contacts',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'waiting_emergency_contacts',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'waiting_new_dates',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'waiting_snapform',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'waiting_icare_confirmation',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'waiting_to_hear_from_seb',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'booking_flag',
        value: 'see_notes',
        created_at: new Date(),
        updated_at: new Date()
      },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('settings', null, {});
  }
};