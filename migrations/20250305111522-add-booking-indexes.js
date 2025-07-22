'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add new columns
    await queryInterface.addColumn('bookings', 'status_name', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    await queryInterface.addColumn('bookings', 'eligibility_name', {
      type: Sequelize.STRING,
      allowNull: true
    });
    
    // 2. Add indexes for optimized queries
    await queryInterface.addIndex('bookings', ['deleted_at'], {
      name: 'idx_bookings_deleted_at'
    });
    
    await queryInterface.addIndex('bookings', ['complete'], {
      name: 'idx_bookings_complete'
    });
    
    await queryInterface.addIndex('bookings', ['type'], {
      name: 'idx_bookings_type'
    });
    
    await queryInterface.addIndex('bookings', ['status_name'], {
      name: 'idx_bookings_status_name'
    });
    
    await queryInterface.addIndex('bookings', ['eligibility_name'], {
      name: 'idx_bookings_eligibility_name'
    });
    
    await queryInterface.addIndex('bookings', ['guest_id'], {
      name: 'idx_bookings_guest_id'
    });
    
    await queryInterface.addIndex('bookings', ['created_at'], {
      name: 'idx_bookings_created_at'
    });
  },
  
  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('bookings', 'idx_bookings_deleted_at');
    await queryInterface.removeIndex('bookings', 'idx_bookings_complete');
    await queryInterface.removeIndex('bookings', 'idx_bookings_type');
    await queryInterface.removeIndex('bookings', 'idx_bookings_status_name');
    await queryInterface.removeIndex('bookings', 'idx_bookings_eligibility_name');
    await queryInterface.removeIndex('bookings', 'idx_bookings_guest_id');
    await queryInterface.removeIndex('bookings', 'idx_bookings_created_at');
    
    // Remove added columns
    await queryInterface.removeColumn('bookings', 'status_name');
    await queryInterface.removeColumn('bookings', 'eligibility_name');
  }
};