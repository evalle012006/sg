'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('email_templates', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      subject: {
        type: Sequelize.STRING(500),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      html_content: {
        type: Sequelize.TEXT('long'),
        allowNull: false
      },
      json_design: {
        type: Sequelize.TEXT('long'),
        allowNull: true
      },
      template_type: {
        type: Sequelize.ENUM('custom', 'system', 'migrated'),
        defaultValue: 'custom',
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },
      preview_image: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('email_templates', ['name'], {
      name: 'idx_email_templates_name'
    });

    await queryInterface.addIndex('email_templates', ['template_type'], {
      name: 'idx_email_templates_template_type'
    });

    await queryInterface.addIndex('email_templates', ['is_active'], {
      name: 'idx_email_templates_is_active'
    });

    await queryInterface.addIndex('email_templates', ['created_by'], {
      name: 'idx_email_templates_created_by'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes first
    await queryInterface.removeIndex('email_templates', 'idx_email_templates_name');
    await queryInterface.removeIndex('email_templates', 'idx_email_templates_template_type');
    await queryInterface.removeIndex('email_templates', 'idx_email_templates_is_active');
    await queryInterface.removeIndex('email_templates', 'idx_email_templates_created_by');

    // Drop table
    await queryInterface.dropTable('email_templates');
  }
};