'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('course_offers', 'timing_text', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Manually editable timing/deadline text displayed in Course Offers list'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('course_offers', 'timing_text');
  }
};