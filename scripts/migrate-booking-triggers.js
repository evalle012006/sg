/**
 * Migration Script: Update SYSTEM Email Triggers ONLY
 * 
 * ✅ CRITICAL: This script ONLY migrates system triggers (type='system')
 * ❌ WILL NOT TOUCH: User-created triggers (type='internal', 'external', 'highlights')
 * 
 * Maps old redundant SYSTEM trigger contexts to new unified system:
 * - booking_confirmed → booking_status_changed + status filter
 * - booking_cancelled → booking_status_changed + status filter
 * - booking_amended → booking_status_changed + status filter
 * - booking_eligibility_changed → booking_status_changed + status filter
 */

const { EmailTrigger } = require('../models');
const { sequelize } = require('../models');

const SYSTEM_TRIGGER_MIGRATIONS = {
  'booking_confirmed': {
    new_context: 'booking_status_changed',
    booking_status: ['booking_confirmed'],
    description_suffix: ' (system - when booking is confirmed)'
  },
  'booking_cancelled': {
    new_context: 'booking_status_changed',
    booking_status: ['booking_cancelled'],
    description_suffix: ' (system - when booking is cancelled)'
  },
  'booking_amended': {
    new_context: 'booking_status_changed',
    booking_status: ['booking_confirmed', 'in_progress'],
    description_suffix: ' (system - when booking is amended)'
  },
  'booking_eligibility_changed': {
    new_context: 'booking_status_changed',
    booking_status: ['eligible', 'ineligible'],
    description_suffix: ' (system - when eligibility changes)'
  }
};

async function analyzeTriggersBeforeMigration() {
  console.log('\n📊 Analyzing Email Triggers...\n');
  
  // Get ALL triggers (for reporting)
  const allTriggers = await EmailTrigger.findAll({
    order: [['type', 'ASC'], ['id', 'ASC']]
  });
  
  console.log(`Total Email Triggers: ${allTriggers.length}\n`);
  
  // Group by type
  const triggersByType = {};
  allTriggers.forEach(trigger => {
    const type = trigger.type || 'unknown';
    if (!triggersByType[type]) {
      triggersByType[type] = [];
    }
    triggersByType[type].push(trigger);
  });
  
  // Display breakdown
  console.log('📋 Breakdown by Type:');
  Object.entries(triggersByType).forEach(([type, triggers]) => {
    const icon = type === 'system' ? '⚙️' : '👤';
    console.log(`   ${icon} ${type}: ${triggers.length} trigger(s)`);
  });
  
  console.log('\n🔍 System Triggers (will be checked for migration):');
  const systemTriggers = triggersByType['system'] || [];
  
  if (systemTriggers.length === 0) {
    console.log('   ⊘ No system triggers found\n');
    return { systemTriggers: [], willMigrate: [], willSkip: [] };
  }
  
  const willMigrate = [];
  const willSkip = [];
  
  systemTriggers.forEach(trigger => {
    const needsMigration = Object.keys(SYSTEM_TRIGGER_MIGRATIONS).includes(trigger.trigger_context);
    
    if (needsMigration) {
      willMigrate.push(trigger);
      const migration = SYSTEM_TRIGGER_MIGRATIONS[trigger.trigger_context];
      console.log(`   ✅ WILL MIGRATE: ID ${trigger.id} - "${trigger.description}"`);
      console.log(`      ${trigger.trigger_context} → ${migration.new_context}`);
      console.log(`      Will add booking_status: [${migration.booking_status.join(', ')}]`);
    } else {
      willSkip.push(trigger);
      console.log(`   ⊘ SKIP: ID ${trigger.id} - "${trigger.description}"`);
      console.log(`      Context: ${trigger.trigger_context} (already correct or not affected)`);
    }
  });
  
  console.log(`\n📊 Migration Impact:`);
  console.log(`   ✅ Will Migrate: ${willMigrate.length} system trigger(s)`);
  console.log(`   ⊘ Will Skip: ${willSkip.length} system trigger(s) (already correct)`);
  
  // Show NON-system triggers (for safety)
  const nonSystemTypes = Object.keys(triggersByType).filter(t => t !== 'system');
  if (nonSystemTypes.length > 0) {
    console.log('\n✋ Non-System Triggers (WILL NOT BE TOUCHED):');
    nonSystemTypes.forEach(type => {
      const triggers = triggersByType[type];
      console.log(`   👤 ${type}: ${triggers.length} trigger(s) - SAFE, will not be modified`);
    });
  }
  
  return {
    systemTriggers,
    willMigrate,
    willSkip,
    nonSystemTriggers: allTriggers.filter(t => t.type !== 'system')
  };
}

async function migrateSystemTriggersOnly() {
  console.log('\n🔄 Starting System Trigger Migration...\n');
  console.log('⚠️  This script will ONLY migrate triggers where type="system"\n');
  
  // First, analyze what will be migrated
  const analysis = await analyzeTriggersBeforeMigration();
  
  if (analysis.willMigrate.length === 0) {
    console.log('\n✅ No system triggers need migration. All done!\n');
    return {
      success: true,
      updated: 0,
      skipped: 0,
      failed: 0
    };
  }
  
  console.log(`\n⚠️  Ready to migrate ${analysis.willMigrate.length} system trigger(s)`);
  console.log(`✋ ${analysis.nonSystemTriggers.length} non-system trigger(s) will NOT be touched\n`);
  
  // Proceed with migration
  const transaction = await sequelize.transaction();
  
  try {
    const results = {
      updated: [],
      skipped: [],
      failed: []
    };
    
    for (const [oldContext, migration] of Object.entries(SYSTEM_TRIGGER_MIGRATIONS)) {
      console.log(`\n📋 Processing system triggers with context: "${oldContext}"`);
      
      // ✅ CRITICAL: Only select triggers where type='system'
      const triggers = await EmailTrigger.findAll({
        where: { 
          trigger_context: oldContext,
          type: 'system'  // ✅ ONLY SYSTEM TRIGGERS
        },
        transaction
      });
      
      console.log(`   Found ${triggers.length} SYSTEM trigger(s) to migrate`);
      
      for (const trigger of triggers) {
        try {
          const oldDescription = trigger.description;
          const oldTriggerContext = trigger.trigger_context;
          
          // Update trigger context
          trigger.trigger_context = migration.new_context;
          
          // Merge existing trigger_conditions with new booking_status
          const existingConditions = trigger.trigger_conditions || {};
          trigger.trigger_conditions = {
            ...existingConditions,
            booking_status: migration.booking_status
          };
          
          // Update description to clarify it's a system trigger
          if (!trigger.description.includes('(system')) {
            trigger.description = trigger.description + migration.description_suffix;
          }
          
          await trigger.save({ transaction });
          
          results.updated.push({
            id: trigger.id,
            type: trigger.type,
            old_context: oldTriggerContext,
            new_context: migration.new_context,
            description: trigger.description
          });
          
          console.log(`   ✅ Updated: System Trigger ${trigger.id}`);
          console.log(`      Type: ${trigger.type} (system only)`);
          console.log(`      Description: "${oldDescription}"`);
          console.log(`      Context: ${oldTriggerContext} → ${migration.new_context}`);
          console.log(`      Booking Status: [${migration.booking_status.join(', ')}]`);
          
        } catch (error) {
          console.error(`   ❌ Failed to update trigger ${trigger.id}:`, error.message);
          results.failed.push({
            id: trigger.id,
            type: trigger.type,
            error: error.message
          });
        }
      }
      
      if (triggers.length === 0) {
        results.skipped.push(oldContext);
        console.log(`   ⊘ No system triggers found for "${oldContext}"`);
      }
    }
    
    await transaction.commit();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 MIGRATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Updated: ${results.updated.length} SYSTEM trigger(s)`);
    console.log(`⊘ Skipped: ${results.skipped.length} context(s) (no triggers found)`);
    console.log(`❌ Failed: ${results.failed.length} trigger(s)`);
    console.log(`✋ Protected: ${analysis.nonSystemTriggers.length} non-system trigger(s) (not touched)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (results.updated.length > 0) {
      console.log('✅ Updated System Triggers:');
      results.updated.forEach(t => {
        console.log(`   • ID ${t.id} (${t.type}): ${t.old_context} → ${t.new_context}`);
        console.log(`     "${t.description}"`);
      });
      console.log('');
    }
    
    if (results.failed.length > 0) {
      console.log('❌ Failed Triggers:');
      results.failed.forEach(f => {
        console.log(`   • ID ${f.id} (${f.type}): ${f.error}`);
      });
      console.log('');
    }
    
    console.log('✅ Migration complete! Only system triggers were modified.\n');
    
    return {
      success: true,
      updated: results.updated.length,
      skipped: results.skipped.length,
      failed: results.failed.length,
      protected: analysis.nonSystemTriggers.length
    };
    
  } catch (error) {
    await transaction.rollback();
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Dry run - show what WOULD be migrated without making changes
 */
async function dryRun() {
  console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  await analyzeTriggersBeforeMigration();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Dry run complete. No changes were made.');
  console.log('   Run without --dry-run to apply migration.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run migration if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  
  if (isDryRun) {
    dryRun()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('❌ Dry run failed:', error);
        process.exit(1);
      });
  } else {
    migrateSystemTriggersOnly()
      .then(result => {
        process.exit(result.failed > 0 ? 1 : 0);
      })
      .catch(error => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
      });
  }
}

module.exports = {
  migrateSystemTriggersOnly,
  analyzeTriggersBeforeMigration,
  dryRun
};