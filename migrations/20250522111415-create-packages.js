'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('packages', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      funder: {
        type: Sequelize.STRING
      },
      price: {
        type: Sequelize.DOUBLE
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
    await queryInterface.dropTable('packages');
  }
};