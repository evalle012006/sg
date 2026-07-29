/**
 * Staging Anonymization Script
 *
 * Replaces real guest PII with realistic fake data for marketing video use.
 * SAFE TO RUN ON STAGING ONLY — do not run on production.
 *
 * Tables affected:
 *   - guests           (name, email, phone, address, dob)
 *   - bookings         (alternate_contact_name, alternate_contact_number)
 *   - health_infos     (emergency contact, GP/specialist info)
 *   - qa_pairs         (answers to name/contact/address questions)
 *   - funding_approvals (plan manager name if present)
 *
 * Strategy: single bulk UPDATE per table using MySQL's ELT(FLOOR(1+RAND()*n), ...)
 * to pick random values inline — no per-row loops, no N+1 queries.
 *
 * Usage: node scripts/anonymize-staging.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize } = require('../models');

// ─── Random value helpers (MySQL inline) ─────────────────────────────────────
// ELT(FLOOR(1 + RAND() * n), 'a', 'b', ...) picks a random element from the list.

function elt(...values) {
  const escaped = values.map(v => `'${v.replace(/'/g, "\\'")}'`).join(', ');
  return `ELT(FLOOR(1 + RAND() * ${values.length}), ${escaped})`;
}

const FIRST_NAMES = [
  'James', 'Emily', 'Oliver', 'Charlotte', 'William', 'Sophia', 'Jack', 'Amelia',
  'Thomas', 'Isabella', 'Henry', 'Mia', 'George', 'Grace', 'Samuel', 'Chloe',
  'Alexander', 'Lily', 'Benjamin', 'Hannah', 'Lucas', 'Zoe', 'Ethan', 'Ella',
  'Noah', 'Ava', 'Mason', 'Scarlett', 'Logan', 'Layla',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Wilson', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
  'Thompson', 'Robinson', 'Clark', 'Walker', 'Hall', 'Young', 'Allen', 'King',
  'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson',
];

const STREETS = [
  'Harbour View Drive', 'Collaroy Parade', 'Pittwater Road', 'Ocean Street',
  'Pacific Highway', 'Beach Road', 'Palm Avenue', 'Coral Street', 'Marine Drive',
  'Sunset Boulevard', 'Lakeside Road', 'Hillcrest Avenue', 'Ferndale Close',
];

const CITIES      = ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Hobart'];
const STATES      = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'ACT', 'TAS'];
const POSTALS     = ['2000', '3000', '4000', '6000', '5000', '2600', '7000', '2100', '3121', '4101'];
const RELATIONS   = ['Spouse', 'Parent', 'Sibling', 'Friend', 'Carer', 'Partner', 'Child'];
const GP_PRACTICES = [
  'Collaroy Medical Centre', 'Northern Beaches Health', 'Pittwater Family Practice',
  'Sydney Spinal Clinic', 'Manly Medical Group', 'Brookvale Health Centre',
];
const GP_FIRST = ['Andrew', 'Sarah', 'Michael', 'Jennifer', 'David', 'Lisa', 'Robert', 'Karen'];
const GP_LAST  = ['Chen', 'Nguyen', 'Patel', 'Murphy', 'Walsh', 'Cooper', 'Burke', 'Ellis'];

// Inline SQL expressions
const SQL_FIRST  = elt(...FIRST_NAMES);
const SQL_LAST   = elt(...LAST_NAMES);
const SQL_FULL   = `CONCAT(${elt(...FIRST_NAMES)}, ' ', ${elt(...LAST_NAMES)})`;
const SQL_PHONE  = `CONCAT('04', LPAD(FLOOR(10000000 + RAND() * 89999999), 8, '0'))`;
const SQL_STREET = `CONCAT(FLOOR(1 + RAND() * 200), ' ', ${elt(...STREETS)})`;
const SQL_CITY   = elt(...CITIES);
const SQL_STATE  = elt(...STATES);
const SQL_POSTAL = elt(...POSTALS);
const SQL_REL    = elt(...RELATIONS);
const SQL_GP_PRACTICE = elt(...GP_PRACTICES);
const SQL_GP_NAME     = `CONCAT('Dr ', ${elt(...GP_FIRST)}, ' ', ${elt(...GP_LAST)})`;
const SQL_EMAIL  = `CONCAT(LOWER(${elt(...FIRST_NAMES)}), '.', LOWER(${elt(...LAST_NAMES)}), FLOOR(100 + RAND() * 900), '@example.com')`;
// DOB: random date between 1950 and 1995
const SQL_DOB    = `DATE_ADD('1950-01-01', INTERVAL FLOOR(RAND() * 16436) DAY)`;

// ─── Anonymization Steps ──────────────────────────────────────────────────────

async function anonymizeGuests() {
  console.log('\n📋 Anonymizing guests table...');

  const [[{ total }]] = await sequelize.query(`SELECT COUNT(*) AS total FROM guests`);
  console.log(`   Found ${total} guests`);

  const [, meta] = await sequelize.query(`
    UPDATE guests SET
      first_name             = ${SQL_FIRST},
      last_name              = ${SQL_LAST},
      email                  = ${SQL_EMAIL},
      phone_number           = ${SQL_PHONE},
      address_street1        = ${SQL_STREET},
      address_street2        = '',
      address_city           = ${SQL_CITY},
      address_state_province = ${SQL_STATE},
      address_postal         = ${SQL_POSTAL},
      address_country        = 'Australia',
      dob                    = ${SQL_DOB}
  `);

  console.log(`   ✅ Updated ${meta.affectedRows} guests`);
}

async function anonymizeBookings() {
  console.log('\n📋 Anonymizing bookings table (alternate contacts)...');

  const [, meta] = await sequelize.query(`
    UPDATE bookings SET
      alternate_contact_name   = ${SQL_FULL},
      alternate_contact_number = ${SQL_PHONE}
    WHERE alternate_contact_name IS NOT NULL
       OR alternate_contact_number IS NOT NULL
  `);

  console.log(`   ✅ Updated ${meta.affectedRows} bookings`);
}

async function anonymizeHealthInfos() {
  console.log('\n📋 Anonymizing health_infos table...');

  const [[{ exists }]] = await sequelize.query(`
    SELECT COUNT(*) AS \`exists\` FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'health_infos'
  `);

  if (!exists) {
    console.log('   ⊘  health_infos table not found — skipping');
    return;
  }

  const [, meta] = await sequelize.query(`
    UPDATE health_infos SET
      emergency_name           = ${SQL_FULL},
      emergency_mobile_number  = ${SQL_PHONE},
      emergency_email          = ${SQL_EMAIL},
      emergency_relationship   = ${SQL_REL},
      specialist_name          = ${SQL_GP_NAME},
      specialist_mobile_number = ${SQL_PHONE},
      specialist_practice_name = ${SQL_GP_PRACTICE}
  `);

  console.log(`   ✅ Updated ${meta.affectedRows} health_infos records`);
}

async function anonymizeQaPairs() {
  console.log('\n📋 Anonymizing qa_pairs table (personal question answers)...');

  // Single UPDATE...JOIN with a CASE on question_key.
  // Each key maps to the appropriate fake SQL expression.
  // Keys not listed are untouched.
  const [, meta] = await sequelize.query(`
    UPDATE qa_pairs qp
    JOIN questions q ON q.id = qp.question_id
    SET qp.answer = CASE q.question_key
      WHEN 'first-name'                            THEN ${SQL_FIRST}
      WHEN 'last-name'                             THEN ${SQL_LAST}
      WHEN 'phone-number'                          THEN ${SQL_PHONE}
      WHEN 'mobile-no'                             THEN ${SQL_PHONE}
      WHEN 'emergency-contact-name'                THEN ${SQL_FULL}
      WHEN 'emergency-contact-phone'               THEN ${SQL_PHONE}
      WHEN 'emergency-contact-email'               THEN ${SQL_EMAIL}
      WHEN 'emergency-contact-relationship-to-you' THEN ${SQL_REL}
      WHEN 'gp-or-specialist-name'                 THEN ${SQL_GP_NAME}
      WHEN 'gp-or-specialist-phone'                THEN ${SQL_PHONE}
      WHEN 'gp-or-specialist-practice-name'        THEN ${SQL_GP_PRACTICE}
      WHEN 'street-address'                        THEN ${SQL_STREET}
      WHEN 'street-address-line-1'                 THEN ${SQL_STREET}
      WHEN 'street-address-line-2-optional'        THEN ''
      WHEN 'street-address-line-2'                 THEN ''
      WHEN 'city'                                  THEN ${SQL_CITY}
      WHEN 'state-province'                        THEN ${SQL_STATE}
      WHEN 'post-code'                             THEN ${SQL_POSTAL}
      WHEN 'country'                               THEN 'Australia'
      ELSE qp.answer
    END
    WHERE q.question_key IN (
      'first-name', 'last-name', 'phone-number', 'mobile-no',
      'emergency-contact-name', 'emergency-contact-phone', 'emergency-contact-email',
      'emergency-contact-relationship-to-you',
      'gp-or-specialist-name', 'gp-or-specialist-phone', 'gp-or-specialist-practice-name',
      'street-address', 'street-address-line-1',
      'street-address-line-2-optional', 'street-address-line-2',
      'city', 'state-province', 'post-code', 'country'
    )
    AND qp.answer IS NOT NULL
    AND qp.answer != ''
  `);

  console.log(`   ✅ Updated ${meta.affectedRows} qa_pairs`);
}

async function anonymizeFundingApprovals() {
  console.log('\n📋 Checking funding_approvals for personal name columns...');

  const [cols] = await sequelize.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'funding_approvals'
      AND column_name IN ('plan_manager_name', 'nominee_name', 'contact_name', 'manager_name')
  `);

  if (!cols.length) {
    console.log('   ⊘  No personal name columns found in funding_approvals — skipping');
    return;
  }

  for (const { column_name } of cols) {
    const [, meta] = await sequelize.query(`
      UPDATE funding_approvals
      SET ${column_name} = ${SQL_FULL}
      WHERE ${column_name} IS NOT NULL
    `);
    console.log(`   ✅ Anonymized funding_approvals.${column_name} (${meta.affectedRows} rows)`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           Staging Anonymization Script                   ║');
  console.log('║   Replaces real PII with fake data for marketing use     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const dbHost = process.env.DB_HOST || process.env.DATABASE_HOST || '';
  if (dbHost.toLowerCase().startsWith('dbaas-db') || dbHost.toLowerCase().includes('prod')) {
    console.error('\n🚨 ABORT: DB_HOST looks like production. Refusing to run.');
    console.error(`   DB_HOST = ${dbHost}`);
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    console.log('\n✓ Database connection established');
    console.log(`  Host: ${dbHost || '(localhost)'}\n`);

    await anonymizeGuests();
    await anonymizeBookings();
    await anonymizeHealthInfos();
    await anonymizeQaPairs();
    await anonymizeFundingApprovals();

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Anonymization complete — staging DB is video-safe    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
  } catch (err) {
    console.error('\n❌ Error during anonymization:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

main();