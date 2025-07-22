'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns to packages table
    await queryInterface.addColumn('packages', 'package_code', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: '', 
      after: 'name'
    });

    await queryInterface.addColumn('packages', 'ndis_package_type', {
      type: Sequelize.ENUM('sta', 'holiday'),
      allowNull: true,
      after: 'funder' // MySQL specific - remove if using PostgreSQL
    });

    await queryInterface.addColumn('packages', 'ndis_line_items', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
      after: 'ndis_package_type' // MySQL specific - remove if using PostgreSQL
    });

    // Update existing funder enum to new values
    // First, add the new enum type
    await queryInterface.sequelize.query(`
      ALTER TABLE packages 
      MODIFY COLUMN funder ENUM('STA', 'HSP', 'NDIS', 'Non-NDIS') 
      NOT NULL
    `);

    // Update existing data
    await queryInterface.sequelize.query(`
      UPDATE packages 
      SET funder = CASE 
        WHEN funder = 'STA' THEN 'NDIS'
        WHEN funder = 'HSP' THEN 'Non-NDIS'
        ELSE funder 
      END
    `);

    // Remove old enum values and keep only new ones
    await queryInterface.sequelize.query(`
      ALTER TABLE packages 
      MODIFY COLUMN funder ENUM('NDIS', 'Non-NDIS') 
      NOT NULL
    `);

    // Set default ndis_package_type for existing NDIS packages
    await queryInterface.sequelize.query(`
      UPDATE packages 
      SET ndis_package_type = 'sta' 
      WHERE funder = 'NDIS' AND ndis_package_type IS NULL
    `);

    // Convert existing NDIS packages with prices to line items
    await queryInterface.sequelize.query(`
      UPDATE packages 
      SET ndis_line_items = JSON_ARRAY(
        JSON_OBJECT(
          'sta_package', CONCAT(name, ' - Default'),
          'line_item', 'DEFAULT_LINE_ITEM',
          'price_per_night', COALESCE(price, 0)
        )
      )
      WHERE funder = 'NDIS' AND price IS NOT NULL AND price > 0
    `);

    // Clear prices for NDIS packages
    await queryInterface.sequelize.query(`
      UPDATE packages 
      SET price = NULL 
      WHERE funder = 'NDIS'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert funder enum back to original values
    await queryInterface.sequelize.query(`
      ALTER TABLE packages 
      MODIFY COLUMN funder ENUM('STA', 'HSP', 'NDIS', 'Non-NDIS') 
      NOT NULL
    `);

    // Restore price from ndis_line_items for rollback
    await queryInterface.sequelize.query(`
      UPDATE packages 
      SET price = COALESCE(
        (SELECT SUM(JSON_UNQUOTE(JSON_EXTRACT(item.value, '$.price_per_night')))
         FROM JSON_TABLE(
           COALESCE(ndis_line_items, JSON_ARRAY()), 
           '$[*]' COLUMNS (value JSON PATH '$')
         ) item), 
         0
      )
      WHERE funder = 'NDIS' AND ndis_line_items IS NOT NULL
    `);

    // Update funder values back to original
    await queryInterface.sequelize.query(`
      UPDATE packages 
      SET funder = CASE 
        WHEN funder = 'NDIS' THEN 'STA'
        WHEN funder = 'Non-NDIS' THEN 'HSP'
        ELSE funder 
      END
    `);

    // Remove new enum values
    await queryInterface.sequelize.query(`
      ALTER TABLE packages 
      MODIFY COLUMN funder ENUM('STA', 'HSP') 
      NOT NULL
    `);

    // Remove the new columns
    await queryInterface.removeColumn('packages', 'ndis_line_items');
    await queryInterface.removeColumn('packages', 'ndis_package_type');
  }
};