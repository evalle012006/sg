/**
 * PURE SQL FIX - No JavaScript regex, pure SQL REPLACE
 * This CANNOT fail - it's direct SQL string replacement
 * 
 * Usage: node scripts/sql-only-fix.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize } = require('../models');

async function sqlOnlyFix() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         PURE SQL FIX - Direct String Replacement          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    console.log('Fixing templates 19 & 20 with SQL REPLACE...\n');

    // Update template 20
    console.log('📝 Updating Template 20 (Booking Confirmed)...');
    await sequelize.query(`
      UPDATE email_templates
      SET 
        html_content = REPLACE(REPLACE(html_content, 
          '{{arrivalDate}}', '{{arrival_date}}'),
          '{{departureDate}}', '{{departure_date}}'
        ),
        required_variables = JSON_ARRAY(
          'accommodation',
          'arrival_date',
          'booking_id',
          'booking_package',
          'departure_date',
          'guest_name',
          'logo_base64'
        )
      WHERE id = 20
    `);
    console.log('   ✅ Template 20 updated\n');

    // Update template 19
    console.log('📝 Updating Template 19 (Booking Confirmed Admin)...');
    await sequelize.query(`
      UPDATE email_templates
      SET 
        html_content = REPLACE(REPLACE(html_content,
          '{{arrivalDate}}', '{{arrival_date}}'),
          '{{departureDate}}', '{{departure_date}}'
        ),
        required_variables = JSON_ARRAY(
          'accommodation',
          'arrival_date',
          'booking_id',
          'booking_package',
          'departure_date',
          'guest_name',
          'icare_funded',
          'logo_base64'
        )
      WHERE id = 19
    `);
    console.log('   ✅ Template 19 updated\n');

    // Verify the fix
    console.log('Verifying changes...\n');
    
    const [results] = await sequelize.query(`
      SELECT 
        id, 
        name,
        html_content LIKE '%{{arrivalDate}}%' as still_has_camelCase,
        html_content LIKE '%{{arrival_date}}%' as now_has_snake_case,
        required_variables
      FROM email_templates
      WHERE id IN (19, 20)
    `);

    for (const row of results) {
      console.log(`Template ${row.id}: ${row.name}`);
      console.log(`   Still has camelCase: ${row.still_has_camelCase ? '❌ YES' : '✅ NO'}`);
      console.log(`   Now has snake_case: ${row.now_has_snake_case ? '✅ YES' : '❌ NO'}`);
      console.log(`   Variables: ${row.required_variables}`);
      console.log('');
    }

    console.log('═'.repeat(60));
    console.log('\n✅ SQL fix complete!\n');
    console.log('Next steps:');
    console.log('1. Add to BookingEmailDataService.js (line ~603):');
    console.log('   emailData.accommodation = firstRoom.RoomType?.name || "";');
    console.log('');
    console.log('2. Restart: pm2 restart all\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

sqlOnlyFix();