'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('templates', 'type', {
      type: Sequelize.ENUM('funded', 'accommodation_only'),
      allowNull: true,
      defaultValue: null,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('templates', 'type');
    await queryInterface.sequelize.query("DROP TYPE IF EXISTS `enum_templates_type`;");
  }
};