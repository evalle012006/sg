'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('question_dependencies', 'operator', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'equals', // every existing row (Q.5240->5241, Q.5399 chains, etc.) keeps working unchanged
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('question_dependencies', 'operator');
  },
};