'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('courses', 'max_offers', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'Maximum number of guests that can be offered this course. NULL = unlimited.',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('courses', 'max_offers');
  },
};