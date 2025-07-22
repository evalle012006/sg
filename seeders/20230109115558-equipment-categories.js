'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('equipment_categories',
      [{
        id: 1,
        name: 'mattress_options',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        name: 'bed_rails',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 3,
        name: 'ceiling_hoist',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 4,
        name: 'sling',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 5,
        name: 'shower_commodes',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 6,
        name: 'adaptive_bathroom_options',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 7,
        name: 'slide_transfer_boards',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 8,
        name: 'wheelchair_chargers',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 9,
        name: 'remote_room_openers',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 10,
        name: 'bed_controllers',
        created_at: new Date(),
        updated_at: new Date(),
      }
      ]);
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
