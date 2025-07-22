'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('rooms', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      order: {
        type: Sequelize.INTEGER
      },
      label: {
        type: Sequelize.STRING
      },
      checkin: {
        type: Sequelize.DATE
      },
      checkout: {
        type: Sequelize.DATE
      },
      arrival_time: {
        type: Sequelize.STRING
      },
      total_guests: {
        type: Sequelize.INTEGER
      },
      adults: {
        type: Sequelize.INTEGER
      },
      children: {
        type: Sequelize.INTEGER
      },
      infants: {
        type: Sequelize.INTEGER
      },
      pets: {
        type: Sequelize.INTEGER
      },
      guests: {
        type: Sequelize.TEXT
      },
      booking_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'bookings', key: 'id'
        }
      },
      room_type_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'room_types', key: 'id'
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
    await queryInterface.dropTable('rooms');
  }
};