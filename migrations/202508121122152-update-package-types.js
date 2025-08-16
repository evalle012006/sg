'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Update the ndis_package_type enum to include 'holiday-plus'
    await queryInterface.sequelize.query(`
      ALTER TABLE packages 
      MODIFY COLUMN ndis_package_type ENUM('sta', 'holiday', 'holiday-plus') 
      NULL
    `);
    
    console.log('✅ Added holiday-plus to ndis_package_type enum');
  },

  async down(queryInterface, Sequelize) {
    // Revert back to original enum values
    // Note: Make sure no records have 'holiday-plus' before running this
    await queryInterface.sequelize.query(`
      ALTER TABLE packages 
      MODIFY COLUMN ndis_package_type ENUM('sta', 'holiday') 
      NULL
    `);
    
    console.log('✅ Reverted ndis_package_type enum to original values');
  }
};