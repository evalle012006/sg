'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('guest_funding', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      guest_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'guests',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      approval_number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      nights_approved: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      nights_used: {
        type: Sequelize.INTEGER,
        default: 0,
        allowNull: false
      },
      package_approved: {
        type: Sequelize.STRING,
        defaultValue: 'iCare',
        allowNull: true
      },
      approval_from: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      approval_to: {
        type: Sequelize.DATEONLY,
        allowNull: true
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

    // Add index for faster lookups
    await queryInterface.addIndex('guest_funding', ['guest_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('guest_funding');
  }
};