'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add calculated price columns to courses table
    await queryInterface.addColumn('courses', 'holiday_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Calculated holiday package price based on course dates and rates'
    });

    await queryInterface.addColumn('courses', 'sta_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Calculated STA service price based on course dates and rates'
    });

    await queryInterface.addColumn('courses', 'price_calculated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when prices were last calculated'
    });

    await queryInterface.addColumn('courses', 'rate_snapshot', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Snapshot of rates used for calculation (for historical reference)'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('courses', 'holiday_price');
    await queryInterface.removeColumn('courses', 'sta_price');
    await queryInterface.removeColumn('courses', 'price_calculated_at');
    await queryInterface.removeColumn('courses', 'rate_snapshot');
  }
};