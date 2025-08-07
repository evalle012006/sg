'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, let's get the package IDs from the existing packages
    // You'll need to adjust these based on your actual package data
    
    const packageRequirements = [
      // WS (Wellness & Support Package) - Non-NDIS - No care, No course
      {
        package_code: 'WS',
        care_hours_min: null,
        care_hours_max: 0,
        requires_no_care: true,
        requires_course: false,
        compatible_with_course: false,
        display_priority: 1,
        notes: 'Non-NDIS package for guests requiring no care and no course'
      },
      
      // WHS (Wellness & High Support) - Non-NDIS - 6 or less hours care OR Course with no care
      {
        package_code: 'WHS', // This might be 'WHSP' based on your data
        care_hours_min: 0,
        care_hours_max: 6,
        requires_no_care: false,
        requires_course: null, // Can be with or without course
        compatible_with_course: true,
        display_priority: 2,
        notes: 'Non-NDIS package for 6 or less hours care, or course with no care'
      },
      
      // WVHS (Wellness & Very High Support) - Non-NDIS - More than 6 hours care OR Course with care
      {
        package_code: 'WVHS', // This might be 'WVHSP' based on your data
        care_hours_min: 6,
        care_hours_max: null,
        requires_no_care: false,
        requires_course: null, // Can be with or without course
        compatible_with_course: true,
        display_priority: 3,
        notes: 'Non-NDIS package for more than 6 hours care, or course with care'
      },
      
      // NDIS SP (NDIS Support Package) - No care
      {
        package_code: 'NDIS_SP',
        care_hours_min: null,
        care_hours_max: 0,
        requires_no_care: true,
        requires_course: null,
        compatible_with_course: true,
        sta_requirements: {
          requires_sta_in_plan: false
        },
        display_priority: 4,
        notes: 'NDIS STA package with no care requirements'
      },
      
      // NDIS CSP (NDIS Care Support Package) - 6 hours or less care
      {
        package_code: 'NDIS_CSP',
        care_hours_min: 0,
        care_hours_max: 6,
        requires_no_care: false,
        requires_course: null,
        compatible_with_course: true,
        sta_requirements: {
          requires_sta_in_plan: true
        },
        display_priority: 5,
        notes: 'NDIS STA package with up to 6 hours care'
      },
      
      // HCSP (High Care Support Package) - More than 6 hours of care
      {
        package_code: 'HCSP',
        care_hours_min: 6,
        care_hours_max: null,
        requires_no_care: false,
        requires_course: null,
        compatible_with_course: true,
        sta_requirements: {
          requires_sta_in_plan: true
        },
        display_priority: 6,
        notes: 'NDIS STA package with more than 6 hours care'
      },
      
      // Holiday Support - NDIS Holiday - No care
      {
        package_code: 'HOLIDAY_SUPPORT',
        care_hours_min: null,
        care_hours_max: 0,
        requires_no_care: true,
        requires_course: null,
        compatible_with_course: true,
        sta_requirements: {
          requires_sta_in_plan: false
        },
        display_priority: 7,
        notes: 'NDIS Holiday package with no care requirements'
      },
      
      // Holiday Support Plus - NDIS Holiday - Care
      {
        package_code: 'HOLIDAY_SUPPORT_PLUS',
        care_hours_min: 0,
        care_hours_max: null,
        requires_no_care: false,
        requires_course: null,
        compatible_with_course: true,
        sta_requirements: {
          requires_sta_in_plan: false
        },
        display_priority: 8,
        notes: 'NDIS Holiday package with care support'
      }
    ];

    // Insert requirements for each package
    for (const req of packageRequirements) {
      try {
        // Find the package by package_code
        const [packages] = await queryInterface.sequelize.query(
          `SELECT id FROM packages WHERE package_code = '${req.package_code}' LIMIT 1`
        );
        
        if (packages.length > 0) {
          const packageId = packages[0].id;
          
          await queryInterface.bulkInsert('package_requirements', [{
            package_id: packageId,
            care_hours_min: req.care_hours_min,
            care_hours_max: req.care_hours_max,
            requires_no_care: req.requires_no_care,
            requires_course: req.requires_course,
            compatible_with_course: req.compatible_with_course,
            living_situation: req.living_situation ? JSON.stringify(req.living_situation) : null,
            sta_requirements: req.sta_requirements ? JSON.stringify(req.sta_requirements) : null,
            display_priority: req.display_priority,
            is_active: true,
            notes: req.notes,
            created_at: new Date(),
            updated_at: new Date()
          }]);
          
          console.log(`✅ Created requirement for package: ${req.package_code}`);
        } else {
          console.log(`⚠️  Package not found: ${req.package_code}`);
        }
      } catch (error) {
        console.error(`❌ Error creating requirement for ${req.package_code}:`, error.message);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('package_requirements', null, {});
  }
};