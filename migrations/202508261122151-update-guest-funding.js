'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Starting guest_funding package migration...');
      
      // Step 1: Add the new package_id column
      console.log('📝 Adding package_id column...');
      await queryInterface.addColumn('guest_funding', 'package_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'packages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });

      // Step 2: Add index for the new package_id column
      console.log('🔍 Adding index for package_id...');
      await queryInterface.addIndex('guest_funding', ['package_id'], {
        name: 'guest_funding_package_id_idx',
        transaction
      });

      // Step 3: Migrate existing data
      console.log('🔄 Migrating existing package_approved data...');
      
      // Get all existing guest_funding records with package_approved values
      const existingRecords = await queryInterface.sequelize.query(
        'SELECT id, package_approved FROM guest_funding WHERE package_approved IS NOT NULL AND package_approved != ""',
        { 
          type: Sequelize.QueryTypes.SELECT,
          transaction 
        }
      );

      console.log(`📊 Found ${existingRecords.length} records to migrate`);

      // Get all packages to create a mapping
      const packages = await queryInterface.sequelize.query(
        'SELECT id, name, package_code FROM packages',
        { 
          type: Sequelize.QueryTypes.SELECT,
          transaction 
        }
      );

      // Create a mapping from package names to IDs
      const packageMapping = new Map();
      packages.forEach(pkg => {
        // Map by exact name
        packageMapping.set(pkg.name, pkg.id);
        
        // Map by name with package code (format: "Name (Code)")
        if (pkg.package_code) {
          const nameWithCode = `${pkg.name} (${pkg.package_code})`;
          packageMapping.set(nameWithCode, pkg.id);
        }
        
        // Map by package code alone
        if (pkg.package_code) {
          packageMapping.set(pkg.package_code, pkg.id);
        }
      });

      // Migrate each record
      let migratedCount = 0;
      let unmatchedCount = 0;
      const unmatchedPackages = new Set();

      for (const record of existingRecords) {
        const packageApproved = record.package_approved.trim();
        let packageId = null;

        // Try exact match first
        if (packageMapping.has(packageApproved)) {
          packageId = packageMapping.get(packageApproved);
        } else {
          // Try case-insensitive match
          for (const [key, value] of packageMapping.entries()) {
            if (key.toLowerCase() === packageApproved.toLowerCase()) {
              packageId = value;
              break;
            }
          }
        }

        if (packageId) {
          await queryInterface.sequelize.query(
            'UPDATE guest_funding SET package_id = :packageId WHERE id = :id',
            {
              replacements: { packageId, id: record.id },
              type: Sequelize.QueryTypes.UPDATE,
              transaction
            }
          );
          migratedCount++;
        } else {
          unmatchedPackages.add(packageApproved);
          unmatchedCount++;
        }
      }

      console.log(`✅ Successfully migrated ${migratedCount} records`);
      if (unmatchedCount > 0) {
        console.log(`⚠️  Could not match ${unmatchedCount} records with packages:`);
        unmatchedPackages.forEach(pkg => console.log(`   - "${pkg}"`));
        console.log('❗ These records will have NULL package_id values');
      }

      // Step 4: Remove the old package_approved column
      console.log('🗑️  Removing old package_approved column...');
      await queryInterface.removeColumn('guest_funding', 'package_approved', { transaction });

      await transaction.commit();
      console.log('✅ Guest funding package migration completed successfully!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      console.log('🔄 Reverting guest_funding package migration...');
      
      // Step 1: Add back the package_approved column
      console.log('📝 Adding back package_approved column...');
      await queryInterface.addColumn('guest_funding', 'package_approved', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'iCare'
      }, { transaction });

      // Step 2: Migrate data back from package_id to package_approved
      console.log('🔄 Migrating package data back...');
      
      const recordsWithPackageId = await queryInterface.sequelize.query(`
        SELECT gf.id, gf.package_id, p.name, p.package_code 
        FROM guest_funding gf 
        LEFT JOIN packages p ON p.id = gf.package_id 
        WHERE gf.package_id IS NOT NULL
      `, {
        type: Sequelize.QueryTypes.SELECT,
        transaction
      });

      for (const record of recordsWithPackageId) {
        let packageName = record.name || 'iCare';
        if (record.package_code) {
          packageName = `${record.name} (${record.package_code})`;
        }
        
        await queryInterface.sequelize.query(
          'UPDATE guest_funding SET package_approved = :packageName WHERE id = :id',
          {
            replacements: { packageName, id: record.id },
            type: Sequelize.QueryTypes.UPDATE,
            transaction
          }
        );
      }

      // Step 3: Remove the package_id column and its index
      console.log('🗑️  Removing package_id index...');
      await queryInterface.removeIndex('guest_funding', 'guest_funding_package_id_idx', { transaction });
      
      console.log('🗑️  Removing package_id column...');
      await queryInterface.removeColumn('guest_funding', 'package_id', { transaction });

      await transaction.commit();
      console.log('✅ Guest funding package migration rollback completed!');
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Migration rollback failed:', error);
      throw error;
    }
  }
};