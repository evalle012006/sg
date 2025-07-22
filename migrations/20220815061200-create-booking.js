'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bookings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      uuid: {
        type: Sequelize.UUID,
        unique: true,
      },
      name: {
        type: Sequelize.STRING
      },
      guest_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'guests', key: 'id'
        }
      },
      type: Sequelize.STRING,
      alternate_contact_name: {
        type: Sequelize.STRING,
      },
      alternate_contact_number: {
        type: Sequelize.STRING,
      },
      type_of_spinal_injury: {
        type: Sequelize.STRING,
      },
      preferred_arrival_date: {
        type: Sequelize.DATE,
      },
      preferred_departure_date: {
        type: Sequelize.DATE,
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'pending_approval'
      },
      complete: {
        type: Sequelize.BOOLEAN,
      },
      metainfo: {
        type: Sequelize.STRING,
        defaultValue: '{"triggered_emails": { "on_submit": false, "on_booking_confirmed": false}, "pdf_export": false, "notifications": false}'
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
    await queryInterface.dropTable('bookings');
  }
};