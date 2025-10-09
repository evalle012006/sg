'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns
    await queryInterface.addColumn('email_triggers', 'email_template_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'email_templates',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('email_triggers', 'trigger_conditions', {
      type: Sequelize.JSON,
      allowNull: true
    });

    await queryInterface.addColumn('email_triggers', 'last_triggered_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('email_triggers', 'trigger_count', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('email_triggers', ['email_template_id'], {
      name: 'idx_email_triggers_email_template_id'
    });

    await queryInterface.addIndex('email_triggers', ['enabled'], {
      name: 'idx_email_triggers_enabled'
    });

    await queryInterface.addIndex('email_triggers', ['type'], {
      name: 'idx_email_triggers_type'
    });

    await queryInterface.addIndex('email_triggers', ['last_triggered_at'], {
      name: 'idx_email_triggers_last_triggered_at'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('email_triggers', 'idx_email_triggers_email_template_id');
    await queryInterface.removeIndex('email_triggers', 'idx_email_triggers_enabled');
    await queryInterface.removeIndex('email_triggers', 'idx_email_triggers_type');
    await queryInterface.removeIndex('email_triggers', 'idx_email_triggers_last_triggered_at');

    // Remove columns
    await queryInterface.removeColumn('email_triggers', 'email_template_id');
    await queryInterface.removeColumn('email_triggers', 'trigger_conditions');
    await queryInterface.removeColumn('email_triggers', 'last_triggered_at');
    await queryInterface.removeColumn('email_triggers', 'trigger_count');
  }
};