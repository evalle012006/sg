'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Get all records with sci_type_level data
      const records = await queryInterface.sequelize.query(
        "SELECT id, sci_type_level FROM health_info WHERE sci_type_level IS NOT NULL AND sci_type_level != ''",
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      // Add a temporary column to hold the JSON data
      await queryInterface.addColumn('health_info', 'sci_type_level_temp', {
        type: Sequelize.JSON,
        allowNull: true
      }, { transaction });

      // Convert existing comma-separated strings to JSON arrays
      for (const record of records) {
        if (record.sci_type_level && typeof record.sci_type_level === 'string') {
          const levels = record.sci_type_level.split(',')
            .map(level => level.trim())
            .filter(level => level);
          
          if (levels.length > 0) {
            await queryInterface.sequelize.query(
              'UPDATE health_info SET sci_type_level_temp = ? WHERE id = ?',
              {
                replacements: [JSON.stringify(levels), record.id],
                type: Sequelize.QueryTypes.UPDATE,
                transaction
              }
            );
          }
        }
      }

      // Remove the old column
      await queryInterface.removeColumn('health_info', 'sci_type_level', { transaction });

      // Rename the temp column to the original name
      await queryInterface.renameColumn('health_info', 'sci_type_level_temp', 'sci_type_level', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Get all records with JSON sci_type_level data
      const records = await queryInterface.sequelize.query(
        'SELECT id, sci_type_level FROM health_info WHERE sci_type_level IS NOT NULL',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      // Add a temporary column to hold the string data
      await queryInterface.addColumn('health_info', 'sci_type_level_temp', {
        type: Sequelize.STRING,
        allowNull: true
      }, { transaction });

      // Convert JSON arrays back to comma-separated strings
      for (const record of records) {
        if (record.sci_type_level && Array.isArray(record.sci_type_level)) {
          const levelString = record.sci_type_level.join(',');
          
          await queryInterface.sequelize.query(
            'UPDATE health_info SET sci_type_level_temp = ? WHERE id = ?',
            {
              replacements: [levelString, record.id],
              type: Sequelize.QueryTypes.UPDATE,
              transaction
            }
          );
        }
      }

      // Remove the JSON column
      await queryInterface.removeColumn('health_info', 'sci_type_level', { transaction });

      // Rename the temp column back
      await queryInterface.renameColumn('health_info', 'sci_type_level_temp', 'sci_type_level', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};