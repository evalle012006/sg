'use strict';

const _ = require('lodash');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('equipments',
      [{
        name: 'Confirm need to tilt commode over the toilet.',
        type: 'independent',
        category_id: 5,
        serial_number: _.random(100000000000, 999999999999),
        purchase_date: new Date(),
        warranty_period: new Date(),
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
