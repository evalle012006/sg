'use strict';

/**
 * Quick Export Script - Run on STAGING
 * 
 * This script exports all template data in the exact format needed
 * for the migration seeder.
 * 
 * Usage:
 *   NODE_ENV=staging node scripts/export-template-for-migration.js <template_id>
 * 
 * Output:
 *   Creates a file: staging-export-<template_id>-<timestamp>.json
 */

const { Template, Page, Section, Question, QuestionDependency, sequelize } = require('../models');

async function exportTemplate(templateId) {
  console.log('\n========================================');
  console.log('Export Template for Migration');
  console.log('========================================\n');

  if (!templateId) {
    console.error('❌ Please provide a template ID');
    console.log('Usage: node scripts/export-template-for-migration.js <template_id>');
    process.exit(1);
  }

  console.log(`📋 Exporting template ID: ${templateId}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);

  // Fetch template with all nested data
  const template = await Template.findOne({
    where: { id: templateId },
    include: [{
      model: Page,
      include: [{
        model: Section,
        where: { model_type: 'page' },
        required: false,
        include: [{
          model: Question,
          required: false
        }]
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
  console.log(`   Pages: ${template.Pages?.length || 0}`);

  // Collect all question IDs
  const allQuestionIds = [];
  let totalSections = 0;
  let totalQuestions = 0;

  template.Pages?.forEach(page => {
    page.Sections?.forEach(section => {
      totalSections++;
      section.Questions?.forEach(question => {
        totalQuestions++;
        allQuestionIds.push(question.id);
      });
    });
  });

  console.log(`   Sections: ${totalSections}`);
  console.log(`   Questions: ${totalQuestions}\n`);

  // Fetch dependencies
  const dependencies = allQuestionIds.length > 0 
    ? await QuestionDependency.findAll({
        where: { question_id: allQuestionIds }
      })
    : [];

  console.log(`   Dependencies: ${dependencies.length}\n`);

  // Build export structure (matching the STAGING_DATA format in the seeder)
  const exportData = {
    _meta: {
      exportedAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      templateId: templateId,
      stats: {
        pages: template.Pages?.length || 0,
        sections: totalSections,
        questions: totalQuestions,
        dependencies: dependencies.length
      }
    },
    template: {
      id: template.id,
      uuid: template.uuid,
      name: template.name,
    },
    pages: template.Pages?.map(page => ({
      id: page.id,
      title: page.title,
      order: page.order,
      sections: page.Sections?.map(section => ({
        id: section.id,
        label: section.label,
        order: section.order,
        type: section.type,
        orig_section_id: section.orig_section_id,
        questions: section.Questions?.map(q => ({
          id: q.id,
          label: q.label,
          type: q.type,
          required: q.required,
          question: q.question,
          question_key: q.question_key,
          options: q.options,
          option_type: q.option_type,
          details: q.details,
          order: q.order,
          prefill: q.prefill,
          has_not_available_option: q.has_not_available_option,
          second_booking_only: q.second_booking_only,
          is_locked: q.is_locked,
          ndis_only: q.ndis_only,
          show_flag: q.show_flag,
          tooltip: q.tooltip,
        })) || []
      })) || []
    })) || [],
    dependencies: dependencies.map(d => ({
      id: d.id,
      question_id: d.question_id,
      dependence_id: d.dependence_id,
      answer: d.answer
    }))
  };

  // Write to file
  const fs = require('fs');
  const path = require('path');
  const filename = `staging-export-${templateId}-${Date.now()}.json`;
  const filepath = path.join(__dirname, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));

  console.log('✅ Export complete!');
  console.log(`   File: ${filepath}\n`);

  // Also generate the JS code that can be directly pasted into the seeder
  console.log('========================================');
  console.log('Copy-Paste Data for Seeder:');
  console.log('========================================\n');
  
  console.log('const STAGING_DATA = ' + JSON.stringify({
    template: exportData.template,
    pages: exportData.pages,
    dependencies: exportData.dependencies
  }, null, 2) + ';\n');

  return exportData;
}

// Main execution
const templateId = parseInt(process.argv[2]);
exportTemplate(templateId)
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  })
  .finally(() => {
    sequelize.close();
  });