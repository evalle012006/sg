'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('health_info', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      guest_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'guests', 
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      identify_aboriginal_torres: {
        type: Sequelize.BOOLEAN,
        allowNull: true 
      },
      language: {
        type: Sequelize.STRING(255)
      },
      require_interpreter: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      cultural_beliefs: {
        type: Sequelize.TEXT 
      },
      emergency_name: {
        type: Sequelize.STRING(255)
      },
      emergency_mobile_number: {
        type: Sequelize.STRING(50)
      },
      emergency_email: {
        type: Sequelize.STRING(255)
      },
      emergency_relationship: {
        type: Sequelize.STRING(100)
      },
      specialist_name: {
        type: Sequelize.STRING(255)
      },
      specialist_mobile_number: {
        type: Sequelize.STRING(50)
      },
      specialist_practice_name: {
        type: Sequelize.STRING(255)
      },
      sci_year: {
        type: Sequelize.STRING(4)
      },
      sci_level_asia: {
        type: Sequelize.STRING(20)
      },
      sci_intial_spinal_rehab: {
        type: Sequelize.STRING(500)
      },
      sci_type: {
        type: Sequelize.STRING(50)
      },
      sci_type_level: {
        type: Sequelize.STRING(100)
      },
      sci_inpatient: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      sci_injury_type: {
        type: Sequelize.STRING(50)
      },
      sci_other_details: {
        type: Sequelize.TEXT
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('health_info', ['guest_id'], {
      unique: true,
      name: 'health_info_guest_id_unique'
    });
  },
  
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('health_info');
  }
};