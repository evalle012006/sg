'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('courses', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      uuid: { type: Sequelize.STRING },
      title: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.TEXT
      },
      start_date: {
        allowNull: false,
        type: Sequelize.DATE
      },
      end_date: {
        allowNull: false,
        type: Sequelize.DATE
      },
      min_start_date: {
        allowNull: false,
        type: Sequelize.DATE
      },
      min_end_date: {
        allowNull: false,
        type: Sequelize.DATE
      },
      duration_hours: {
        type: Sequelize.STRING
      },
      holiday_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Calculated holiday package price based on course dates and rates'
      },
      sta_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Calculated STA service price based on course dates and rates'
      },
      price_calculated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when prices were last calculated'
      },
      rate_snapshot: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Snapshot of rates used for calculation (for historical reference)'
      },
      image_filename: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'pending'
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
    await queryInterface.dropTable('courses');
  }
};