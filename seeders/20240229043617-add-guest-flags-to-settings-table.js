'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('settings', [
      { attribute: 'guest_flag', value: 'complex-care', created_at: new Date(), updated_at: new Date() },
      { attribute: 'guest_flag', value: 'banned', created_at: new Date(), updated_at: new Date() },
      { attribute: 'guest_flag', value: 'outstanding-invoices', created_at: new Date(), updated_at: new Date() },
      { attribute: 'guest_flag', value: 'specific-room-requirements', created_at: new Date(), updated_at: new Date() },
      { attribute: 'guest_flag', value: 'account-credit', created_at: new Date(), updated_at: new Date() },
      { attribute: 'guest_flag', value: 'deceased', created_at: new Date(), updated_at: new Date() },
      { attribute: 'guest_flag', value: 'not-eligible', created_at: new Date(), updated_at: new Date() },
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('settings', {
      attribute: 'guest-flag',
      value: [
        'complex-care',
        'banned',
        'outstanding-invoices',
        'specific-room-requirements',
        'account-credit',
        'deceased',
        'not-eligible'
      ]
    }, {});
  }
};