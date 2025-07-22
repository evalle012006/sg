'use strict';

const _ = require('lodash');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('equipments',
      [{
        name: 'I verify all the nformation above is true and updated',
        type: 'acknowledgement',
        category_id: null,
        serial_number: null,
        purchase_date: null,
        warranty_period: null,
        status: '',
        image_filename: '',
        hidden: true,
        created_at: new Date(),
        updated_at: new Date(),
      }]);
  },


  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
