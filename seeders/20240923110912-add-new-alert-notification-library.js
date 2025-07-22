'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('notifications_library', [{
        id: 16,
        name: 'New Account',
        type: 'alert',
        notification_to: 'info@sargoodoncollaroy.com.au',
        notification: 'A new account created [guest_email]',
        alert_type: 'admin',
        date_factor: 0,
        created_at: new Date(),
        updated_at: new Date(),
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
