'use strict';

/**
 * Migration: Add System Trigger Support to EmailTriggers
 * 
 * This migration extends the email_triggers table to support system-level triggers
 * that fire based on application events (status changes, submissions, etc.)
 * rather than just booking form question responses.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add trigger_context column - defines WHEN the trigger fires
    await queryInterface.addColumn('email_triggers', 'trigger_context', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'System context where trigger fires (e.g., booking_status_changed, course_eoi_submitted)',
      after: 'type'
    });

    // 2. Add context_conditions column - defines CONDITIONS within the context
    await queryInterface.addColumn('email_triggers', 'context_conditions', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Conditions that must be met within the context (e.g., {status_to: "booking_confirmed"})',
      after: 'trigger_context'
    });

    // 3. Add data_mapping column - optional custom data transformations
    await queryInterface.addColumn('email_triggers', 'data_mapping', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Optional custom data field mappings and transformations',
      after: 'context_conditions'
    });

    // 4. Add priority column - for trigger execution order
    await queryInterface.addColumn('email_triggers', 'priority', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Execution priority (higher number = higher priority)',
      after: 'data_mapping'
    });

    // 5. Add description column - for documentation
    await queryInterface.addColumn('email_triggers', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Human-readable description of what this trigger does',
      after: 'priority'
    });

    // 6. Update type enum to include 'system'
    await queryInterface.changeColumn('email_triggers', 'type', {
      type: Sequelize.ENUM('highlights', 'external', 'internal', 'system'),
      allowNull: true
    });

    // 7. Add index for faster lookups
    await queryInterface.addIndex('email_triggers', ['trigger_context', 'enabled'], {
      name: 'idx_email_triggers_context_enabled'
    });

    await queryInterface.addIndex('email_triggers', ['type', 'enabled'], {
      name: 'idx_email_triggers_type_enabled'
    });

    console.log('✅ System trigger columns added successfully');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await queryInterface.removeIndex('email_triggers', 'idx_email_triggers_context_enabled');
    await queryInterface.removeIndex('email_triggers', 'idx_email_triggers_type_enabled');

    // Remove columns
    await queryInterface.removeColumn('email_triggers', 'description');
    await queryInterface.removeColumn('email_triggers', 'priority');
    await queryInterface.removeColumn('email_triggers', 'data_mapping');
    await queryInterface.removeColumn('email_triggers', 'context_conditions');
    await queryInterface.removeColumn('email_triggers', 'trigger_context');

    // Revert type enum
    await queryInterface.changeColumn('email_triggers', 'type', {
      type: Sequelize.ENUM('highlights', 'external', 'internal'),
      allowNull: true
    });

    console.log('✅ System trigger columns removed successfully');
  }
};