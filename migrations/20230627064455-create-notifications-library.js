'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications_library', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING,
      },
      type: {
        type: Sequelize.STRING,  // 'alert', 'email', 'sms'
      },
      notification_to: {
        type: Sequelize.STRING,
      },
      notification: {
        type: Sequelize.STRING,
      },
      date_factor: {
        type: Sequelize.INTEGER, // +1, -1, -2, 0 etc - used to calculate the date
      },                        //   of the notification from the arrival date
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
  }
};
