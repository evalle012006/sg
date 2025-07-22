'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('notifications_library', [{
      id: 1,
      name: 'Request for Recreation',
      type: 'alert',
      notification_to: 'rec@sargoodoncollaroy.com.au',
      notification: 'Please contact [guest_name] regarding recreation during their stay starting [arrival_date]',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      name: 'Request for Nurse Education',
      type: 'alert',
      notification_to: 'rita.cusmiani@sargoodoncollaroy.com.au',
      notification: 'Please contact [guest_name] regarding Nurse Education during their stay starting [arrival_date]',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 3,
      name: 'Request for OT',
      type: 'alert',
      notification_to: 'David.simpson@sargoodoncollaroy.com.au',
      notification: 'Please contact [guest_name] regarding OT during their stay starting [arrival_date]',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 4,
      name: 'Booking Change',
      type: 'alert',
      notification_to: 'info@sargoodoncollaroy.com.au',
      notification: 'Please review recently guest amended booking for [guest_name], arriving [arrival_date]',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 5,
      name: 'Booking Change',
      type: 'alert',
      notification_to: 'steph.henzlik@sargoodoncollaroy.com.au',
      notification: 'Please review recently guest amended booking for [guest_name], arriving [arrival_date]',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 6,
      name: 'New Guest',
      type: 'alert',
      notification_to: 'Jessica.allen@sargoodoncollaroy.com.au',
      notification: 'Please contact new guest, [guest_name] regarding their stay starting [arrival_date]',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }, {
      id: 7,
      name: 'Low Asset Type',
      type: 'alert',
      notification_to: 'info@sargoodoncollaroy.com.au',
      notification: '[asset_type] is running low. [asset_count] left for date: [date]',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }, {
      id: 8,
      name: 'Placeholder Asset Type',
      type: 'alert',
      notification_to: 'info@sargoodoncollaroy.com.au',
      notification: 'There a shortage of [asset_count] [asset_type] for [date]',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }
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
