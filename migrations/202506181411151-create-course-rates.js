'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('course_rates', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      category: {
        type: Sequelize.ENUM('holiday', 'sta'),
        allowNull: false
      },
      day_type: {
        type: Sequelize.ENUM('weekday', 'saturday', 'sunday', 'public_holiday'),
        allowNull: false
      },
      package_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    // Add index for efficient querying
    await queryInterface.addIndex('course_rates', ['category', 'day_type', 'order']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('course_rates');
  }
};