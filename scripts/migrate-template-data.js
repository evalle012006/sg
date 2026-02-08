'use strict';

/**
 * Migration Script: Transfer Template Data from Staging to Production
 * 
 * This script transfers template > pages > sections > questions > question_dependencies
 * from staging to production database.
 * 
 * IMPORTANT: Templates and Pages keep their existing IDs
 *            Sections, Questions, and QuestionDependencies get NEW IDs
 * 
 * Usage:
 *   1. First, run EXPORT mode on STAGING to export data to JSON:
 *      NODE_ENV=staging node scripts/migrate-template-data.js export <template_id>
 * 
 *   2. Then, run IMPORT mode on PRODUCTION to import with new IDs:
 *      NODE_ENV=production node scripts/migrate-template-data.js import <path_to_json>
 * 
 *   3. Or run PREVIEW mode to see what would be imported without making changes:
 *      NODE_ENV=production node scripts/migrate-template-data.js preview <path_to_json>
 */

const { Template, Page, Section, Question, QuestionDependency, sequelize } = require('../models');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Starting IDs for new records (adjust based on your production database)
// Run this query on production to find the max IDs:
// SELECT MAX(id) FROM sections; SELECT MAX(id) FROM questions; SELECT MAX(id) FROM question_dependencies;
const CONFIG = {
  STARTING_SECTION_ID: 1000,      // Change this based on production max section ID + buffer
  STARTING_QUESTION_ID: 2000,     // Change this based on production max question ID + buffer
  STARTING_DEPENDENCY_ID: 500,    // Change this based on production max dependency ID + buffer
  DRY_RUN: false,                 // Set to true to preview without making changes
};

// ============================================================================
// EXPORT FUNCTION - Run on STAGING
// ============================================================================

async function exportTemplateData(templateId) {
  console.log('\n========================================');
  console.log('Template Data Export Script');
  console.log('========================================\n');

  console.log(`📋 Exporting template ID: ${templateId}\n`);

  // Fetch the complete template with all nested data
  const template = await Template.findOne({
    where: { id: templateId },
    include: [{
      model: Page,
      include: [{
        model: Section,
        include: [Question]
      }]
    }],
    order: [
      [Page, 'order', 'ASC'],
      [Page, Section, 'order', 'ASC'],
      [Page, Section, Question, 'order', 'ASC']
    ]
  });

  if (!template) {
    console.error(`❌ Template with ID ${templateId} not found!`);
    process.exit(1);
  }

  console.log(`✅ Found template: "${template.name}"`);
  console.log(`   UUID: ${template.uuid}`);
  console.log(`   Pages: ${template.Pages?.length || 0}\n`);

  // Collect all question IDs for fetching dependencies
  const allQuestionIds = [];
  template.Pages?.forEach(page => {
    page.Sections?.forEach(section => {
      section.Questions?.forEach(question => {
        allQuestionIds.push(question.id);
      });
    });
  });

  console.log(`📊 Total questions found: ${allQuestionIds.length}`);

  // Fetch all question dependencies for these questions
  const dependencies = await QuestionDependency.findAll({
    where: {
      question_id: allQuestionIds
    }
  });

  console.log(`📊 Total dependencies found: ${dependencies.length}\n`);

  // Build export data structure
  const exportData = {
    exportedAt: new Date().toISOString(),
    sourceEnvironment: process.env.NODE_ENV || 'unknown',
    template: {
      id: template.id,
      uuid: template.uuid,
      name: template.name,
    },
    pages: template.Pages?.map(page => ({
      id: page.id,
      title: page.title,
      description: page.description,
      template_id: page.template_id,
      order: page.order,
      sections: page.Sections?.map(section => ({
        id: section.id,
        label: section.label,
        order: section.order,
        type: section.type,
        model_type: section.model_type,
        model_id: section.model_id,
        orig_section_id: section.orig_section_id,
        questions: section.Questions?.map(question => ({
          id: question.id,
          section_id: question.section_id,
          label: question.label,
          type: question.type,
          required: question.required,
          question: question.question,
          question_key: question.question_key,
          options: question.options,
          option_type: question.option_type,
          details: question.details,
          order: question.order,
          prefill: question.prefill,
          has_not_available_option: question.has_not_available_option,
          second_booking_only: question.second_booking_only,
          is_locked: question.is_locked,
          ndis_only: question.ndis_only,
          show_flag: question.show_flag,
          tooltip: question.tooltip,
        })) || []
      })) || []
    })) || [],
    dependencies: dependencies.map(dep => ({
      id: dep.id,
      question_id: dep.question_id,
      dependence_id: dep.dependence_id,
      answer: dep.answer,
    })),
    // Store original ID counts for verification
    stats: {
      pagesCount: template.Pages?.length || 0,
      sectionsCount: template.Pages?.reduce((sum, p) => sum + (p.Sections?.length || 0), 0) || 0,
      questionsCount: allQuestionIds.length,
      dependenciesCount: dependencies.length,
    }
  };

  // Write to file
  const filename = `template-export-${templateId}-${Date.now()}.json`;
  const filepath = path.join(__dirname, filename);
  fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

  console.log(`✅ Export complete!`);
  console.log(`   File: ${filepath}`);
  console.log(`\n📊 Export Statistics:`);
  console.log(`   Pages: ${exportData.stats.pagesCount}`);
  console.log(`   Sections: ${exportData.stats.sectionsCount}`);
  console.log(`   Questions: ${exportData.stats.questionsCount}`);
  console.log(`   Dependencies: ${exportData.stats.dependenciesCount}`);
  console.log(`\n✨ Next step: Run import on PRODUCTION with this file`);
  
  return exportData;
}

// ============================================================================
// IMPORT FUNCTION - Run on PRODUCTION
// ============================================================================

async function importTemplateData(jsonFilePath, dryRun = false) {
  console.log('\n========================================');
  console.log('Template Data Import Script');
  console.log(dryRun ? '(DRY RUN - No changes will be made)' : '(LIVE RUN - Changes will be applied)');
  console.log('========================================\n');

  // Read the export file
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ File not found: ${jsonFilePath}`);
    process.exit(1);
  }

  const exportData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  
  console.log(`📋 Import file: ${jsonFilePath}`);
  console.log(`   Exported at: ${exportData.exportedAt}`);
  console.log(`   Source environment: ${exportData.sourceEnvironment}`);
  console.log(`   Template: "${exportData.template.name}" (ID: ${exportData.template.id})\n`);

  // ============================================================================
  // STEP 1: Determine starting IDs based on production database
  // ============================================================================
  
  console.log('📊 Step 1: Determining starting IDs...');
  
  const [maxSectionResult] = await sequelize.query('SELECT COALESCE(MAX(id), 0) as max_id FROM sections');
  const [maxQuestionResult] = await sequelize.query('SELECT COALESCE(MAX(id), 0) as max_id FROM questions');
  const [maxDependencyResult] = await sequelize.query('SELECT COALESCE(MAX(id), 0) as max_id FROM question_dependencies');
  
  const maxSectionId = maxSectionResult[0].max_id;
  const maxQuestionId = maxQuestionResult[0].max_id;
  const maxDependencyId = maxDependencyResult[0].max_id;
  
  console.log(`   Current max section ID: ${maxSectionId}`);
  console.log(`   Current max question ID: ${maxQuestionId}`);
  console.log(`   Current max dependency ID: ${maxDependencyId}\n`);
  
  // Start from max + 1 with some buffer
  let nextSectionId = Math.max(maxSectionId + 1, CONFIG.STARTING_SECTION_ID);
  let nextQuestionId = Math.max(maxQuestionId + 1, CONFIG.STARTING_QUESTION_ID);
  let nextDependencyId = Math.max(maxDependencyId + 1, CONFIG.STARTING_DEPENDENCY_ID);
  
  console.log(`   Starting section ID: ${nextSectionId}`);
  console.log(`   Starting question ID: ${nextQuestionId}`);
  console.log(`   Starting dependency ID: ${nextDependencyId}\n`);

  // ============================================================================
  // STEP 2: Build ID mappings
  // ============================================================================
  
  console.log('📊 Step 2: Building ID mappings...');
  
  const sectionIdMap = new Map(); // oldId -> newId
  const questionIdMap = new Map(); // oldId -> newId
  
  // Map sections
  exportData.pages.forEach(page => {
    page.sections.forEach(section => {
      sectionIdMap.set(section.id, nextSectionId++);
    });
  });
  
  // Map questions
  exportData.pages.forEach(page => {
    page.sections.forEach(section => {
      section.questions.forEach(question => {
        questionIdMap.set(question.id, nextQuestionId++);
      });
    });
  });
  
  console.log(`   Section mappings: ${sectionIdMap.size}`);
  console.log(`   Question mappings: ${questionIdMap.size}\n`);

  // ============================================================================
  // STEP 3: Check if template and pages exist
  // ============================================================================
  
  console.log('📊 Step 3: Verifying template and pages...');
  
  const existingTemplate = await Template.findByPk(exportData.template.id);
  if (!existingTemplate) {
    console.log(`   ⚠️  Template ID ${exportData.template.id} does not exist in production.`);
    console.log(`   You may need to create it first or update the template ID in the export file.\n`);
    
    if (!dryRun) {
      console.log('   Creating template...');
      await Template.create({
        id: exportData.template.id,
        uuid: exportData.template.uuid,
        name: exportData.template.name,
      });
      console.log(`   ✅ Template created\n`);
    }
  } else {
    console.log(`   ✅ Template exists: "${existingTemplate.name}"\n`);
  }
  
  // Check pages
  for (const page of exportData.pages) {
    const existingPage = await Page.findByPk(page.id);
    if (!existingPage) {
      console.log(`   ⚠️  Page ID ${page.id} (${page.title}) does not exist.`);
      if (!dryRun) {
        await Page.create({
          id: page.id,
          title: page.title,
          description: page.description || null,
          template_id: exportData.template.id, // Use template ID from export data
          order: page.order || 0,
        });
        console.log(`   ✅ Page created: ${page.title}`);
      }
    } else {
      console.log(`   ✅ Page exists: "${existingPage.title}" (ID: ${page.id})`);
    }
  }
  console.log('');

  // ============================================================================
  // STEP 4: Prepare data with new IDs
  // ============================================================================
  
  console.log('📊 Step 4: Preparing data with new IDs...');
  
  const sectionsToCreate = [];
  const questionsToCreate = [];
  const dependenciesToCreate = [];
  
  // Prepare sections and questions
  exportData.pages.forEach(page => {
    page.sections.forEach(section => {
      const newSectionId = sectionIdMap.get(section.id);
      
      sectionsToCreate.push({
        id: newSectionId,
        label: section.label,
        order: section.order,
        type: section.type,
        model_type: 'page',
        model_id: page.id, // Keep the same page ID
        orig_section_id: section.orig_section_id,
        created_at: new Date(),
        updated_at: new Date(),
      });
      
      section.questions.forEach(question => {
        const newQuestionId = questionIdMap.get(question.id);
        
        questionsToCreate.push({
          id: newQuestionId,
          section_id: newSectionId, // Use the NEW section ID
          label: question.label,
          type: question.type,
          required: question.required,
          question: question.question,
          question_key: question.question_key,
          options: typeof question.options === 'string' ? question.options : JSON.stringify(question.options),
          option_type: question.option_type,
          details: typeof question.details === 'string' ? question.details : JSON.stringify(question.details),
          order: question.order,
          prefill: question.prefill,
          has_not_available_option: question.has_not_available_option,
          second_booking_only: question.second_booking_only,
          is_locked: question.is_locked,
          ndis_only: question.ndis_only,
          show_flag: question.show_flag,
          tooltip: question.tooltip,
          created_at: new Date(),
          updated_at: new Date(),
        });
      });
    });
  });
  
  // Prepare dependencies with new question IDs
  exportData.dependencies.forEach(dep => {
    const newQuestionId = questionIdMap.get(dep.question_id);
    const newDependenceId = questionIdMap.get(dep.dependence_id);
    
    if (!newQuestionId) {
      console.log(`   ⚠️  Warning: question_id ${dep.question_id} not found in mapping`);
      return;
    }
    
    if (!newDependenceId) {
      console.log(`   ⚠️  Warning: dependence_id ${dep.dependence_id} not found in mapping`);
      return;
    }
    
    dependenciesToCreate.push({
      id: nextDependencyId++,
      question_id: newQuestionId,
      dependence_id: newDependenceId,
      answer: dep.answer,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });
  
  console.log(`   Sections to create: ${sectionsToCreate.length}`);
  console.log(`   Questions to create: ${questionsToCreate.length}`);
  console.log(`   Dependencies to create: ${dependenciesToCreate.length}\n`);

  // ============================================================================
  // STEP 5: Execute import (or preview)
  // ============================================================================
  
  if (dryRun) {
    console.log('📊 Step 5: Preview (DRY RUN)...\n');
    
    console.log('Sections to be created:');
    sectionsToCreate.forEach(s => {
      console.log(`   ID: ${s.id} | Label: "${s.label}" | Page: ${s.model_id} | Order: ${s.order}`);
    });
    
    console.log('\nQuestions to be created:');
    questionsToCreate.forEach(q => {
      console.log(`   ID: ${q.id} | Section: ${q.section_id} | Type: ${q.type} | Q: "${q.question?.substring(0, 50)}..."`);
    });
    
    console.log('\nDependencies to be created:');
    dependenciesToCreate.forEach(d => {
      console.log(`   ID: ${d.id} | Question: ${d.question_id} | Depends on: ${d.dependence_id} | Answer: "${d.answer}"`);
    });
    
    console.log('\n✨ DRY RUN complete. No changes were made.');
    console.log('   Run without --preview to apply changes.\n');
    
  } else {
    console.log('📊 Step 5: Executing import...\n');
    
    const transaction = await sequelize.transaction();
    
    try {
      // Insert sections
      if (sectionsToCreate.length > 0) {
        await sequelize.queryInterface.bulkInsert('sections', sectionsToCreate, { transaction });
        console.log(`   ✅ Created ${sectionsToCreate.length} sections`);
      }
      
      // Insert questions
      if (questionsToCreate.length > 0) {
        await sequelize.queryInterface.bulkInsert('questions', questionsToCreate, { transaction });
        console.log(`   ✅ Created ${questionsToCreate.length} questions`);
      }
      
      // Insert dependencies
      if (dependenciesToCreate.length > 0) {
        await sequelize.queryInterface.bulkInsert('question_dependencies', dependenciesToCreate, { transaction });
        console.log(`   ✅ Created ${dependenciesToCreate.length} dependencies`);
      }
      
      await transaction.commit();
      
      console.log('\n✅ Import complete!\n');
      
      // Print ID mapping summary
      console.log('📊 ID Mapping Summary:');
      console.log('\nSection ID Mappings (old -> new):');
      sectionIdMap.forEach((newId, oldId) => {
        console.log(`   ${oldId} -> ${newId}`);
      });
      
      console.log('\nQuestion ID Mappings (old -> new):');
      questionIdMap.forEach((newId, oldId) => {
        console.log(`   ${oldId} -> ${newId}`);
      });
      
      // Save mapping to file for reference
      const mappingData = {
        importedAt: new Date().toISOString(),
        sourceFile: jsonFilePath,
        sectionIdMap: Object.fromEntries(sectionIdMap),
        questionIdMap: Object.fromEntries(questionIdMap),
      };
      
      const mappingFilename = `id-mapping-${Date.now()}.json`;
      const mappingFilepath = path.join(__dirname, mappingFilename);
      fs.writeFileSync(mappingFilepath, JSON.stringify(mappingData, null, 2));
      console.log(`\n💾 ID mappings saved to: ${mappingFilepath}`);
      
    } catch (error) {
      await transaction.rollback();
      console.error('\n❌ Import failed! Transaction rolled back.');
      console.error('Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// ============================================================================
// ALTERNATIVE: Direct Database to Database Migration
// ============================================================================

async function migrateDirectly(templateId, stagingDbConfig) {
  console.log('\n========================================');
  console.log('Direct Database Migration');
  console.log('========================================\n');
  
  console.log('This mode connects to both staging and production databases');
  console.log('and transfers data directly.\n');
  
  // This would require setting up a second Sequelize connection to staging
  // For simplicity, the export/import method is recommended
  
  console.log('❌ Direct migration not implemented.');
  console.log('   Please use the export/import method instead.\n');
}

// ============================================================================
// UTILITY: Generate SQL Script (for manual execution)
// ============================================================================

async function generateSqlScript(jsonFilePath) {
  console.log('\n========================================');
  console.log('Generate SQL Script');
  console.log('========================================\n');

  if (!fs.existsSync(jsonFilePath)) {
    console.error(`❌ File not found: ${jsonFilePath}`);
    process.exit(1);
  }

  const exportData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
  
  // Get max IDs from current database
  const [maxSectionResult] = await sequelize.query('SELECT COALESCE(MAX(id), 0) as max_id FROM sections');
  const [maxQuestionResult] = await sequelize.query('SELECT COALESCE(MAX(id), 0) as max_id FROM questions');
  const [maxDependencyResult] = await sequelize.query('SELECT COALESCE(MAX(id), 0) as max_id FROM question_dependencies');
  
  let nextSectionId = Math.max(maxSectionResult[0].max_id + 1, CONFIG.STARTING_SECTION_ID);
  let nextQuestionId = Math.max(maxQuestionResult[0].max_id + 1, CONFIG.STARTING_QUESTION_ID);
  let nextDependencyId = Math.max(maxDependencyResult[0].max_id + 1, CONFIG.STARTING_DEPENDENCY_ID);
  
  const sectionIdMap = new Map();
  const questionIdMap = new Map();
  
  let sql = '-- Template Migration SQL Script\n';
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- Source: ${jsonFilePath}\n\n`;
  
  sql += 'BEGIN;\n\n';
  
  // Generate section inserts
  sql += '-- Sections\n';
  exportData.pages.forEach(page => {
    page.sections.forEach(section => {
      const newSectionId = nextSectionId++;
      sectionIdMap.set(section.id, newSectionId);
      
      sql += `INSERT INTO sections (id, label, "order", type, model_type, model_id, orig_section_id, created_at, updated_at)\n`;
      sql += `VALUES (${newSectionId}, '${(section.label || '').replace(/'/g, "''")}', ${section.order}, '${section.type}', 'page', ${page.id}, ${section.orig_section_id || 'NULL'}, NOW(), NOW());\n`;
    });
  });
  
  sql += '\n-- Questions\n';
  exportData.pages.forEach(page => {
    page.sections.forEach(section => {
      const newSectionId = sectionIdMap.get(section.id);
      
      section.questions.forEach(question => {
        const newQuestionId = nextQuestionId++;
        questionIdMap.set(question.id, newQuestionId);
        
        const options = question.options ? JSON.stringify(question.options).replace(/'/g, "''") : 'NULL';
        const details = question.details ? JSON.stringify(question.details).replace(/'/g, "''") : 'NULL';
        const questionText = (question.question || '').replace(/'/g, "''");
        const questionKey = question.question_key ? `'${question.question_key.replace(/'/g, "''")}'` : 'NULL';
        const tooltip = question.tooltip ? `'${question.tooltip.replace(/'/g, "''")}'` : 'NULL';
        
        sql += `INSERT INTO questions (id, section_id, label, type, required, question, question_key, options, option_type, details, "order", prefill, has_not_available_option, second_booking_only, is_locked, ndis_only, show_flag, tooltip, created_at, updated_at)\n`;
        sql += `VALUES (${newQuestionId}, ${newSectionId}, ${question.label ? `'${question.label.replace(/'/g, "''")}'` : 'NULL'}, '${question.type}', ${question.required || false}, '${questionText}', ${questionKey}, ${options === 'NULL' ? 'NULL' : `'${options}'`}, ${question.option_type ? `'${question.option_type}'` : 'NULL'}, ${details === 'NULL' ? 'NULL' : `'${details}'`}, ${question.order || 0}, ${question.prefill || false}, ${question.has_not_available_option || false}, ${question.second_booking_only || false}, ${question.is_locked || false}, ${question.ndis_only || false}, ${question.show_flag ? `'${question.show_flag}'` : 'NULL'}, ${tooltip}, NOW(), NOW());\n`;
      });
    });
  });
  
  sql += '\n-- Question Dependencies\n';
  exportData.dependencies.forEach(dep => {
    const newQuestionId = questionIdMap.get(dep.question_id);
    const newDependenceId = questionIdMap.get(dep.dependence_id);
    
    if (newQuestionId && newDependenceId) {
      const newDepId = nextDependencyId++;
      sql += `INSERT INTO question_dependencies (id, question_id, dependence_id, answer, created_at, updated_at)\n`;
      sql += `VALUES (${newDepId}, ${newQuestionId}, ${newDependenceId}, '${(dep.answer || '').replace(/'/g, "''")}', NOW(), NOW());\n`;
    }
  });
  
  sql += '\nCOMMIT;\n';
  
  // Save SQL file
  const sqlFilename = `migration-${Date.now()}.sql`;
  const sqlFilepath = path.join(__dirname, sqlFilename);
  fs.writeFileSync(sqlFilepath, sql);
  
  console.log(`✅ SQL script generated: ${sqlFilepath}`);
  console.log('\nYou can execute this script manually on your production database.');
  
  // Also save the ID mappings
  const mappingData = {
    generatedAt: new Date().toISOString(),
    sectionIdMap: Object.fromEntries(sectionIdMap),
    questionIdMap: Object.fromEntries(questionIdMap),
  };
  
  const mappingFilename = `id-mapping-${Date.now()}.json`;
  const mappingFilepath = path.join(__dirname, mappingFilename);
  fs.writeFileSync(mappingFilepath, JSON.stringify(mappingData, null, 2));
  console.log(`💾 ID mappings saved to: ${mappingFilepath}`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  console.log('\n🚀 Template Migration Tool');
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (!command) {
    console.log('\nUsage:');
    console.log('  Export from staging:');
    console.log('    NODE_ENV=staging node scripts/migrate-template-data.js export <template_id>');
    console.log('\n  Import to production:');
    console.log('    NODE_ENV=production node scripts/migrate-template-data.js import <json_file>');
    console.log('\n  Preview import (dry run):');
    console.log('    NODE_ENV=production node scripts/migrate-template-data.js preview <json_file>');
    console.log('\n  Generate SQL script:');
    console.log('    NODE_ENV=production node scripts/migrate-template-data.js sql <json_file>');
    process.exit(0);
  }
  
  try {
    switch (command) {
      case 'export':
        const templateId = parseInt(args[1]);
        if (!templateId) {
          console.error('❌ Please provide a template ID');
          process.exit(1);
        }
        await exportTemplateData(templateId);
        break;
        
      case 'import':
        const importFile = args[1];
        if (!importFile) {
          console.error('❌ Please provide a JSON file path');
          process.exit(1);
        }
        await importTemplateData(importFile, false);
        break;
        
      case 'preview':
        const previewFile = args[1];
        if (!previewFile) {
          console.error('❌ Please provide a JSON file path');
          process.exit(1);
        }
        await importTemplateData(previewFile, true);
        break;
        
      case 'sql':
        const sqlFile = args[1];
        if (!sqlFile) {
          console.error('❌ Please provide a JSON file path');
          process.exit(1);
        }
        await generateSqlScript(sqlFile);
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();