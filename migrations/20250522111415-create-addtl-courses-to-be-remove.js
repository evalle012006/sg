'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const addColumnSafe = async (table, column, definition) => {
      try {
        await queryInterface.addColumn(table, column, definition);
      } catch (error) {
        if (!error.message.includes('Duplicate column')) {
          throw error;
        }
        console.log(`Column ${column} already exists, skipping...`);
      }
    };

    await addColumnSafe('courses', 'holiday_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Calculated holiday package price based on course dates and rates'
    });

    await addColumnSafe('courses', 'sta_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Calculated STA service price based on course dates and rates'
    });

    await addColumnSafe('courses', 'price_calculated_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when prices were last calculated'
    });

    await addColumnSafe('courses', 'rate_snapshot', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Snapshot of rates used for calculation (for historical reference)'
    });
  },

  async down(queryInterface, Sequelize) {
    const removeColumnSafe = async (table, column) => {
      try {
        await queryInterface.removeColumn(table, column);
      } catch (error) {
        console.log(`Column ${column} doesn't exist, skipping removal...`);
      }
    };

    await removeColumnSafe('courses', 'holiday_price');
    await removeColumnSafe('courses', 'sta_price');
    await removeColumnSafe('courses', 'price_calculated_at');
    await removeColumnSafe('courses', 'rate_snapshot');
  }
};