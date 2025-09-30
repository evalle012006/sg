'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (t) => {
      // Add new columns for additional room tracking
      await queryInterface.addColumn('guest_funding', 'additional_room_approved', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'room_types',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction: t });

      await queryInterface.addColumn('guest_funding', 'additional_room_nights_approved', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: true
      }, { transaction: t });

      await queryInterface.addColumn('guest_funding', 'additional_room_nights_used', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false
      }, { transaction: t });

      // Add index for better query performance
      await queryInterface.addIndex('guest_funding', ['additional_room_approved'], {
        name: 'idx_guest_funding_additional_room',
        transaction: t
      });
    });
  },

  async down(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (t) => {
      // Remove index first
      await queryInterface.removeIndex('guest_funding', 'idx_guest_funding_additional_room', { transaction: t });

      // Remove columns
      await queryInterface.removeColumn('guest_funding', 'additional_room_nights_used', { transaction: t });
      await queryInterface.removeColumn('guest_funding', 'additional_room_nights_approved', { transaction: t });
      await queryInterface.removeColumn('guest_funding', 'additional_room_approved', { transaction: t });
    });
  }
};