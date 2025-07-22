'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Delete existing booking_status and booking_eligibility rows
    await queryInterface.bulkDelete('settings', {
      attribute: {
        [Sequelize.Op.in]: ['booking_status', 'booking_eligibility']
      }
    });

    // Insert new booking_status and booking_eligibility rows
    await queryInterface.bulkInsert('settings', [
      {
        attribute: 'booking_status',
        value: JSON.stringify({ name: 'pending_approval', label: 'Pending Approval', color: 'amber' }),
      },
      {
        attribute: 'booking_status',
        value: JSON.stringify({ name: 'ready_to_process', label: 'Ready to Process', color: 'fuchsia' }),
      },
      {
        attribute: 'booking_status',
        value: JSON.stringify({ name: 'in_progress', label: 'In Progress', color: 'sky' }),
      },
      {
        attribute: 'booking_status',
        value: JSON.stringify({ name: 'booking_amended', label: 'Amendment Requested', color: 'orange' }),
      },
      {
        attribute: 'booking_status',
        value: JSON.stringify({ name: 'booking_confirmed', label: 'Booking Confirmed', color: 'green' }),
      },
      {
        attribute: 'booking_status',
        value: JSON.stringify({ name: 'booking_cancelled', label: 'Booking Cancelled', color: 'red'}),
      },
      {
        attribute: 'booking_status',
        value: JSON.stringify({ name: 'awaiting_icare_approval', label: 'Awaiting iCare Approval', color: 'slate' }),
      },
      {
        attribute: 'booking_eligibility',
        value: JSON.stringify({ name: 'pending_eligibility', label: 'Pending Eligibility', color: 'amber' }),
      },
      {
        attribute: 'booking_eligibility',
        value: JSON.stringify({ name: 'eligible', label: 'Eligible', color: 'green' }),
      },
      {
        attribute: 'booking_eligibility',
        value: JSON.stringify({ name: 'ineligible', label: 'Not Eligible', color: 'red' }),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Delete new booking_status and booking_eligibility rows
    await queryInterface.bulkDelete('settings', {
      attribute: {
        [Sequelize.Op.in]: ['booking_status', 'booking_eligibility']
      }
    });

    // Revert to old booking_status and booking_eligibility rows
    // Add your old values here
  }
};