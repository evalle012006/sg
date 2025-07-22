'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('equipments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      type: {
        type: Sequelize.STRING
      },
      category: {
        type: Sequelize.STRING
      },
      image_filename: {
        allowNull: true,
        type: Sequelize.STRING
      },
      serial_number: {
        allowNull: true,
        type: Sequelize.STRING
      },
      purchase_date: {
        allowNull: true,
        type: Sequelize.DATE
      },
      last_service_date: {
        allowNull: true,
        type: Sequelize.DATE
      },
      next_service_date: {
        allowNull: true,
        type: Sequelize.DATE
      },
      warranty_period: {
        allowNull: true,
        type: Sequelize.DATE
      },
      status: {
        allowNull: true,
        type: Sequelize.STRING
      },
      supplier: {
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
    await queryInterface.dropTable('equipments');
  }
};