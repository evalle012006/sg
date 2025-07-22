'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('room_types', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      type: {
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING
      },
      ergonomic_king_beds: {
        type: Sequelize.INTEGER
      },
      king_single_beds: {
        type: Sequelize.INTEGER
      },
      queen_sofa_beds: {
        type: Sequelize.INTEGER
      },
      bedrooms: {
        type: Sequelize.INTEGER
      },
      bathrooms: {
        type: Sequelize.INTEGER
      },
      ocean_view: {
        type: Sequelize.INTEGER
      },
      max_guests: {
        type: Sequelize.INTEGER
      },
      price_per_night: {
        type: Sequelize.FLOAT
      },
      image_filename: {
        type: Sequelize.STRING
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
    await queryInterface.dropTable('room_types');
  }
};