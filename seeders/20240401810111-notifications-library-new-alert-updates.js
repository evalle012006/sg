'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('notifications_library', {
      name: {
        [Sequelize.Op.in]: ['Booking Status Change']
      }
    });

    await queryInterface.bulkInsert('notifications_library', [{
        id: 10,
        name: 'Booking Status Change',
        type: 'alert',
        notification_to: 'info@sargoodoncollaroy.com.au',
        notification: 'Booking ID [booking_id] for guest [guest_name] [has been] [status]',
        alert_type: 'admin',
        date_factor: 0,
        created_at: new Date(),
        updated_at: new Date(),
    },
    {
        id: 12,
        name: 'Booking Status Change',
        type: 'alert',
        notification_to: 'info@sargoodoncollaroy.com.au',
        notification: 'Booking ID [booking_id] [has been] [status]',
        alert_type: 'guest',
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
