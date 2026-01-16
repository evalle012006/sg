'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Step 1: Drop the existing foreign key constraint
    await queryInterface.removeConstraint(
      'booking_approval_usages',
      'booking_approval_usages_ibfk_2'
    );

    // Step 2: Rename the column from guest_approval_id to funding_approval_id
    await queryInterface.renameColumn(
      'booking_approval_usages',
      'guest_approval_id',
      'funding_approval_id'
    );

    // Step 3: Clear any existing data that might have invalid references
    // (Optional - only if you want to clean up orphaned records)
    await queryInterface.sequelize.query(`
      UPDATE booking_approval_usages 
      SET funding_approval_id = NULL 
      WHERE funding_approval_id NOT IN (SELECT id FROM funding_approvals)
    `);

    // Step 4: Add the new foreign key constraint to funding_approvals
    await queryInterface.addConstraint('booking_approval_usages', {
      fields: ['funding_approval_id'],
      type: 'foreign key',
      name: 'booking_approval_usages_funding_approval_fk',
      references: {
        table: 'funding_approvals',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Step 5: Update the index
    try {
      await queryInterface.removeIndex('booking_approval_usages', ['guest_approval_id']);
    } catch (e) {
      // Index might not exist, continue
    }
    
    await queryInterface.addIndex('booking_approval_usages', ['funding_approval_id']);
  },

  async down(queryInterface, Sequelize) {
    // Reverse the migration
    
    // Step 1: Drop the new foreign key constraint
    await queryInterface.removeConstraint(
      'booking_approval_usages',
      'booking_approval_usages_funding_approval_fk'
    );

    // Step 2: Rename column back
    await queryInterface.renameColumn(
      'booking_approval_usages',
      'funding_approval_id',
      'guest_approval_id'
    );

    // Step 3: Add back the original foreign key constraint
    await queryInterface.addConstraint('booking_approval_usages', {
      fields: ['guest_approval_id'],
      type: 'foreign key',
      name: 'booking_approval_usages_ibfk_2',
      references: {
        table: 'guest_approvals',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Step 4: Update the index
    try {
      await queryInterface.removeIndex('booking_approval_usages', ['funding_approval_id']);
    } catch (e) {
      // Index might not exist
    }
    
    await queryInterface.addIndex('booking_approval_usages', ['guest_approval_id']);
  }
};