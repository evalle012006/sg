'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('notifications_library', [{
      id: 9,
      name: 'New Booking for Returning Guest',
      type: 'alert',
      notification_to: 'info@sargoodoncollaroy.com.au',
      notification: 'Please contact returning guest, [guest_name] regarding their stay',
      alert_type: 'admin',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }, {
      id: 10,
      name: 'Booking Status Change',
      type: 'alert',
      notification_to: 'info@sargoodoncollaroy.com.au',
      notification: 'Booking ID [booking_id] for guest [guest_name] status changed to [status]',
      alert_type: 'admin',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 11,
      name: 'New Booking',
      type: 'alert',
      notification_to: 'info@sargoodoncollaroy.com.au',
      notification: '[guest_name] created a new booking.',
      alert_type: 'admin',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }, {
      id: 12,
      name: 'Booking Status Change',
      type: 'alert',
      notification_to: 'info@sargoodoncollaroy.com.au',
      notification: 'Booking ID [booking_id] status changed to [status]',
      alert_type: 'guest',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 13,
      name: 'User Created',
      type: 'alert',
      notification_to: 'info@sargoodoncollaroy.com.au',
      notification: 'New user created: [user_email]',
      alert_type: 'admin',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    }, {
      id: 14,
      name: 'User Updated',
      type: 'alert',
      notification_to: 'info@sargoodoncollaroy.com.au',
      notification: 'User [user_email] was updated',
      alert_type: 'admin',
      date_factor: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 15,
      name: 'User Deleted',
      type: 'alert',
      notification_to: 'info@sargoodoncollaroy.com.au',
      notification: 'User deleted: [user_email]',
      alert_type: 'admin',
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
