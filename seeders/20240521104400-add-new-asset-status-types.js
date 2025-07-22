'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('settings', [
      {
        attribute: 'asset_status',
        value: JSON.stringify({ "label": "All", "value": "all" }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'asset_status',
        value: JSON.stringify({ label: 'Active', value: 'Active' }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'asset_status',
        value: JSON.stringify({ label: 'Decommissioned', value: 'Decommissioned' }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'asset_status',
        value: JSON.stringify({ label: 'Needs Maintenance', value: 'Needs Maintenance' }),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        attribute: 'asset_status',
        value: JSON.stringify({ label: 'Being Repaired', value: 'Being Repaired' }),
        created_at: new Date(),
        updated_at: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('settings', null, {});
  }
};