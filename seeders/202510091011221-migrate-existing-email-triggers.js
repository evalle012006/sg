'use strict';

const fs = require('fs');
const path = require('path');

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('\n========================================');
    console.log('Email Trigger Migration Seeder');
    console.log('========================================\n');

    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Step 1: Get all unique email templates from existing triggers
      const [existingTriggers] = await queryInterface.sequelize.query(
        `SELECT DISTINCT email_template 
         FROM email_triggers 
         WHERE email_template IS NOT NULL 
           AND email_template != '' 
           AND email_template_id IS NULL
         ORDER BY email_template`,
        { transaction }
      );

      if (existingTriggers.length === 0) {
        console.log('✅ No email triggers need migration');
        await transaction.commit();
        return;
      }

      console.log(`📊 Found ${existingTriggers.length} unique email template(s) to migrate\n`);

      const templateMapping = {}; // Map old template names to new IDs
      let createdCount = 0;
      let reusedCount = 0;
      let skippedCount = 0;

      // Step 2: Process each unique template
      for (const trigger of existingTriggers) {
        const templateName = trigger.email_template;

        try {
          console.log(`🔄 Processing template: ${templateName}`);

          // Check if template already exists as migrated
          const [existingTemplate] = await queryInterface.sequelize.query(
            `SELECT id, name FROM email_templates 
             WHERE name LIKE :name AND template_type = 'migrated'
             LIMIT 1`,
            {
              replacements: { 
                name: `%${templateName.split('-').map(w => 
                  w.charAt(0).toUpperCase() + w.slice(1)
                ).join(' ')}%` 
              },
              type: Sequelize.QueryTypes.SELECT,
              transaction
            }
          );

          if (existingTemplate) {
            console.log(`   ♻️  Template already exists (ID: ${existingTemplate.id}): ${existingTemplate.name}`);
            templateMapping[templateName] = existingTemplate.id;
            reusedCount++;
            continue;
          }

          // Read the HTML template file
          const templatePath = path.join(
            __dirname,
            '..',
            'templates',
            'email',
            `${templateName}.html`
          );

          if (!fs.existsSync(templatePath)) {
            console.log(`   ⚠️  Template file not found: ${templatePath}`);
            console.log(`   ⏭️  Skipping...`);
            skippedCount++;
            continue;
          }

          const htmlContent = fs.readFileSync(templatePath, 'utf-8');

          // Generate friendly name from template name
          const friendlyName = templateName
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          // Generate subject based on template type
          let subject = 'Sargood On Collaroy - ';
          if (templateName.includes('booking') && templateName.includes('amended')) {
            subject += 'Booking Amendment';
          } else if (templateName.includes('booking')) {
            subject += 'New Booking';
          } else if (templateName.includes('recipient')) {
            subject += 'Notification';
          } else if (templateName.includes('health')) {
            subject += 'Health Information';
          } else if (templateName.includes('foundation')) {
            subject += 'Foundation Stay';
          } else {
            subject += friendlyName;
          }

          // Create the email template
          const [newTemplate] = await queryInterface.sequelize.query(
            `INSERT INTO email_templates 
             (name, subject, description, html_content, template_type, is_active, created_at, updated_at)
             VALUES (:name, :subject, :description, :html_content, 'migrated', true, NOW(), NOW())`,
            {
              replacements: {
                name: `Migrated: ${friendlyName}`,
                subject: subject,
                description: `Migrated from legacy template: ${templateName}`,
                html_content: htmlContent
              },
              transaction
            }
          );

          // Get the inserted ID
          const [insertedTemplate] = await queryInterface.sequelize.query(
            `SELECT LAST_INSERT_ID() as id`,
            { type: Sequelize.QueryTypes.SELECT, transaction }
          );

          const newTemplateId = insertedTemplate.id;
          templateMapping[templateName] = newTemplateId;

          console.log(`   ✨ Created new template (ID: ${newTemplateId}): Migrated: ${friendlyName}`);
          createdCount++;

        } catch (error) {
          console.error(`   ❌ Error processing template ${templateName}:`, error.message);
          skippedCount++;
        }
      }

      console.log('\n========================================');
      console.log('Step 1 Summary: Template Creation');
      console.log('========================================');
      console.log(`✨ Created: ${createdCount}`);
      console.log(`♻️  Reused: ${reusedCount}`);
      console.log(`⏭️  Skipped: ${skippedCount}`);
      console.log('========================================\n');

      // Step 3: Update email triggers to reference new templates
      console.log('📝 Step 2: Updating email triggers...\n');

      let updatedCount = 0;
      let updateSkippedCount = 0;

      for (const [templateName, templateId] of Object.entries(templateMapping)) {
        try {
          // Update all triggers with this template name
          const [result] = await queryInterface.sequelize.query(
            `UPDATE email_triggers 
             SET email_template_id = :templateId, updated_at = NOW()
             WHERE email_template = :templateName 
               AND email_template_id IS NULL`,
            {
              replacements: { templateId, templateName },
              transaction
            }
          );

          const rowsAffected = result.affectedRows || 0;
          if (rowsAffected > 0) {
            console.log(`   ✅ Updated ${rowsAffected} trigger(s) for template: ${templateName} → template ID ${templateId}`);
            updatedCount += rowsAffected;
          }

        } catch (error) {
          console.error(`   ❌ Error updating triggers for ${templateName}:`, error.message);
          updateSkippedCount++;
        }
      }

      console.log('\n========================================');
      console.log('Step 2 Summary: Trigger Updates');
      console.log('========================================');
      console.log(`✅ Updated triggers: ${updatedCount}`);
      console.log(`❌ Failed updates: ${updateSkippedCount}`);
      console.log('========================================\n');

      // Step 4: Verify migration
      const [verificationResults] = await queryInterface.sequelize.query(
        `SELECT 
          COUNT(*) as total_triggers,
          SUM(CASE WHEN email_template_id IS NOT NULL THEN 1 ELSE 0 END) as migrated_triggers,
          SUM(CASE WHEN email_template_id IS NULL AND email_template IS NOT NULL THEN 1 ELSE 0 END) as unmigrated_triggers
         FROM email_triggers`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      const stats = verificationResults;

      console.log('========================================');
      console.log('Final Migration Summary');
      console.log('========================================');
      console.log(`📊 Total email triggers: ${stats.total_triggers}`);
      console.log(`✅ Migrated triggers: ${stats.migrated_triggers}`);
      console.log(`⏭️  Unmigrated triggers: ${stats.unmigrated_triggers}`);
      console.log(`📈 Migration progress: ${Math.round((stats.migrated_triggers / stats.total_triggers) * 100)}%`);
      console.log('========================================\n');

      if (stats.unmigrated_triggers > 0) {
        console.log('⚠️  Warning: Some triggers were not migrated. Check the logs above for details.\n');
      } else {
        console.log('🎉 All email triggers successfully migrated!\n');
      }

      // Commit transaction
      await transaction.commit();
      console.log('✅ Migration seeder completed successfully!\n');

    } catch (error) {
      await transaction.rollback();
      console.error('\n❌ Migration seeder failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    console.log('\n========================================');
    console.log('Reverting Email Trigger Migration');
    console.log('========================================\n');

    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Step 1: Clear email_template_id from triggers
      console.log('🔄 Clearing email_template_id from triggers...');
      
      const [result1] = await queryInterface.sequelize.query(
        `UPDATE email_triggers 
         SET email_template_id = NULL 
         WHERE email_template_id IS NOT NULL`,
        { transaction }
      );

      console.log(`   ✅ Cleared ${result1.affectedRows || 0} trigger(s)`);

      // Step 2: Delete migrated templates
      console.log('\n🗑️  Deleting migrated email templates...');
      
      const [result2] = await queryInterface.sequelize.query(
        `DELETE FROM email_templates 
         WHERE template_type = 'migrated'`,
        { transaction }
      );

      console.log(`   ✅ Deleted ${result2.affectedRows || 0} template(s)`);

      await transaction.commit();
      
      console.log('\n✅ Migration rollback completed successfully!\n');

    } catch (error) {
      await transaction.rollback();
      console.error('\n❌ Rollback failed:', error);
      throw error;
    }
  }
};