'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add option_type column to questions table
    await queryInterface.addColumn('questions', 'option_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: 'Type of options for card selection questions (e.g., funder, course)'
    });

    // Update existing card selection questions to have 'funder' as default option_type
    await queryInterface.bulkUpdate(
      'questions',
      { option_type: 'funder' },
      {
        type: {
          [Sequelize.Op.in]: [
            'card-selection',
            'card-selection-multi',
            'horizontal-card',
            'horizontal-card-multi'
          ]
        }
      }
    );

  },

  async down(queryInterface, Sequelize) {
    // Remove the option_type column
    await queryInterface.removeColumn('questions', 'option_type');
    console.log('✅ Successfully removed option_type column');
  }
};