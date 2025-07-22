'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('booking_equipments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      booking_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'bookings', key: 'id'
        }
      },
      equipment_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'equipments', key: 'id'
        }
      },
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
    await queryInterface.dropTable('booking_equipments');
  }
};