'use strict';

const { faker } = require('@faker-js/faker');

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.bulkInsert('settings', [{
      attribute: 'default_template',
      value: 1,
    },
    {
      attribute: 'default_checklist',
      value: 100,
    },
    {
      attribute: 'booking_status',
      value: JSON.stringify({ name: 'enquiry', label: 'Enquiry', color: 'gray' }),
    }, 
    {
      attribute: 'booking_status',
      value: JSON.stringify({ name: 'in_progress', label: 'Pending Approval', color: 'yellow' }),
    }, 
    {
      attribute: 'booking_status',
      value: JSON.stringify({ name: 'booking_confirmed', label: 'Booking Confirmed', color: 'green' }),
    },
    {
      attribute: 'booking_status',
      value: JSON.stringify({ name: 'booking_amended', label: 'Booking Amended', color: 'lime' }),
    },
    {
      attribute: 'section_type',
      value: JSON.stringify({ name: 'row', label: 'Row' }),
    },
    {
      attribute: 'section_type',
      value: JSON.stringify({ name: '2_columns', label: '2 Columns' }),
    },
    {
      attribute: 'section_type',
      value: JSON.stringify({ name: '3_columns', label: '3 Columns' }),
    },
    {
      attribute: 'section_type',
      value: JSON.stringify({ name: '4_columns', label: '4 Columns' }),
    }, {
      attribute: 'booking_eligibility',
      value: JSON.stringify({ name: 'pending_approval', label: 'Pending Approval', color: 'yellow' }),
    }, {
      attribute: 'booking_eligibility',
      value: JSON.stringify({ name: 'eligible', label: 'Eligible', color: 'lime' }),
    }, {
      attribute: 'booking_eligibility',
      value: JSON.stringify({ name: 'ineligible', label: 'Not Eligible', color: 'red' }),
    }, {
      attribute: 'booking_eligibility',
      value: JSON.stringify({ name: 'pending_funding_approval', label: 'Pending Funding Approval', color: 'sky' }),
    }], {});

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
