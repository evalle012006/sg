'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    queryInterface.bulkInsert('permissions', [
      { action: 'manage', subject: 'Setting', created_at: new Date(), updated_at: new Date()}
    ]);
  },

  async down(queryInterface, Sequelize) {
    queryInterface.bulkDelete('permissions', {
      action: 'manage',
      subject: 'Setting'
    });
  }
};
