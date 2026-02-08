'use strict';

const { Guest, HealthInfo, QaPair, Question, Section, Booking } = require('../models');
const { Op } = require('sequelize');

/**
 * Sync guest profiles from their latest booking's qa_pairs.
 * Maps question_keys to guest and health_info fields based on BookingRequestForm logic.
 */
async function syncGuestProfilesFromBookings() {
    try {
        console.log('\n========================================');
        console.log('Guest Profile Sync from Latest Bookings');
        console.log('========================================\n');

        // Get all guests with their latest booking
        const guests = await Guest.findAll({
            include: [{
                model: Booking,
                where: { deleted_at: null },
                required: true,
                separate: true,
                order: [['created_at', 'DESC']],
                limit: 1,
                as: 'Bookings'
            }],
            order: [['id', 'ASC']]
        });

        console.log(`📊 Found ${guests.length} guests with bookings to process\n`);

        if (guests.length === 0) {
            console.log('✅ No guests with bookings found. All done!');
            return;
        }

        let updatedGuestsCount = 0;
        let updatedHealthInfoCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const guest of guests) {
            const latestBooking = guest.Bookings && guest.Bookings[0];
            
            if (!latestBooking) {
                console.log(`   ⏭️  Skipping Guest #${guest.id} (${guest.uuid}): No booking found`);
                skippedCount++;
                continue;
            }

            console.log(`\n--- Processing Guest #${guest.id} (${guest.uuid}) - Booking: ${latestBooking.uuid} ---`);

            try {
                // Get all sections for this booking
                const sections = await Section.findAll({
                    where: {
                        model_id: latestBooking.id,
                        model_type: 'booking'
                    },
                    include: [{
                        model: QaPair,
                        include: [{
                            model: Question,
                            where: {
                                question_key: { [Op.ne]: null }
                            },
                            required: true
                        }],
                        where: {
                            answer: { [Op.ne]: null }
                        },
                        required: false
                    }]
                });

                // Collect all qa_pairs with question_keys
                const qaPairs = [];
                sections.forEach(section => {
                    if (section.QaPairs && section.QaPairs.length > 0) {
                        qaPairs.push(...section.QaPairs);
                    }
                });

                if (qaPairs.length === 0) {
                    console.log(`   ⊘ No qa_pairs with question_keys found`);
                    skippedCount++;
                    continue;
                }

                console.log(`   📝 Found ${qaPairs.length} qa_pairs to process`);

                // Prepare updates
                const guestUpdates = {};
                const healthInfoUpdates = {};

                // Process each qa_pair
                for (const qaPair of qaPairs) {
                    const questionKey = qaPair.Question.question_key;
                    let answer = qaPair.answer;

                    // Parse JSON answers
                    try {
                        if (typeof answer === 'string' && (answer.startsWith('[') || answer.startsWith('{'))) {
                            answer = JSON.parse(answer);
                        }
                    } catch (e) {
                        // Keep original if not valid JSON
                    }

                    // Map to guest/healthinfo fields
                    switch (questionKey) {
                        // Basic guest information
                        case 'first-name':
                            guestUpdates.first_name = answer;
                            break;
                        case 'last-name':
                            guestUpdates.last_name = answer;
                            break;
                        case 'email':
                            guestUpdates.email = answer;
                            break;
                        case 'phone-number':
                        case 'mobile-no':
                            guestUpdates.phone_number = answer;
                            break;
                        case 'gender-person-with-sci':
                            guestUpdates.gender = answer;
                            break;
                        case 'date-of-birth-person-with-sci':
                            guestUpdates.dob = answer;
                            break;

                        // Address fields
                        case 'street-address':
                        case 'street-address-line-1':
                            guestUpdates.address_street1 = answer;
                            break;
                        case 'street-address-line-2-optional':
                        case 'street-address-line-2':
                            guestUpdates.address_street2 = answer;
                            break;
                        case 'city':
                            guestUpdates.address_city = answer;
                            break;
                        case 'state-province':
                            guestUpdates.address_state_province = answer;
                            break;
                        case 'post-code':
                            guestUpdates.address_postal = answer;
                            break;
                        case 'country':
                            guestUpdates.address_country = answer;
                            break;

                        // Health Info - Emergency Contact
                        case 'emergency-contact-name':
                            healthInfoUpdates.emergency_name = answer;
                            break;
                        case 'emergency-contact-phone':
                            healthInfoUpdates.emergency_mobile_number = answer;
                            break;
                        case 'emergency-contact-email':
                            healthInfoUpdates.emergency_email = answer;
                            break;
                        case 'emergency-contact-relationship-to-you':
                            healthInfoUpdates.emergency_relationship = answer;
                            break;

                        // Health Info - GP/Specialist
                        case 'gp-or-specialist-name':
                            healthInfoUpdates.specialist_name = answer;
                            break;
                        case 'gp-or-specialist-phone':
                            healthInfoUpdates.specialist_mobile_number = answer;
                            break;
                        case 'gp-or-specialist-practice-name':
                            healthInfoUpdates.specialist_practice_name = answer;
                            break;

                        // Health Info - Cultural/Language
                        case 'do-you-identify-as-aboriginal-or-torres-strait-islander-person-with-sci':
                            healthInfoUpdates.identify_aboriginal_torres = 
                                answer === 'Yes' || answer === true;
                            break;
                        case 'do-you-speak-a-language-other-than-english-at-home-person-with-sci':
                            healthInfoUpdates.language = answer;
                            break;
                        case 'language-spoken-at-home':
                            if (!healthInfoUpdates.language && answer && answer !== 'No') {
                                healthInfoUpdates.language = answer;
                            }
                            break;
                        case 'do-you-require-an-interpreter':
                            healthInfoUpdates.require_interpreter = 
                                answer === 'Yes' || answer === true;
                            break;
                        case 'do-you-have-any-cultural-beliefs-or-values-that-you-would-like-our-staff-to-be-aware-of':
                            if (answer !== 'No' && answer !== false) {
                                healthInfoUpdates.cultural_beliefs = answer;
                            }
                            break;
                        case 'please-give-details-on-cultural-beliefs-or-values-you-would-like-our-staff-to-be-aware-of':
                            healthInfoUpdates.cultural_beliefs = answer;
                            break;

                        // Health Info - SCI
                        case 'what-year-did-you-begin-living-with-your-spinal-cord-injury':
                            healthInfoUpdates.sci_year = answer;
                            break;
                        case 'leveltype-of-spinal-cord-injury':
                            healthInfoUpdates.sci_type = answer;
                            break;
                        case 'level-of-function-or-asia-scale-score-movementsensation':
                            healthInfoUpdates.sci_level_asia = answer;
                            break;
                        case 'where-did-you-complete-your-initial-spinal-cord-injury-rehabilitation':
                            healthInfoUpdates.sci_intial_spinal_rehab = answer;
                            break;
                        case 'are-you-currently-an-inpatient-at-a-hospital-or-a-rehabilitation-facility':
                            healthInfoUpdates.sci_inpatient = 
                                answer === 'Yes' || answer === true;
                            break;

                        // Health Info - SCI Type Levels (arrays)
                        case 'c-cervical-level-select-all-that-apply':
                        case 't-thoracic-level-select-all-that-apply':
                        case 'l-lumbar-level-select-all-that-apply':
                        case 's-sacral-level-select-all-that-apply':
                            if (!healthInfoUpdates.sci_type_level) {
                                healthInfoUpdates.sci_type_level = [];
                            }
                            if (Array.isArray(answer)) {
                                healthInfoUpdates.sci_type_level = [
                                    ...healthInfoUpdates.sci_type_level,
                                    ...answer
                                ];
                            } else if (answer) {
                                healthInfoUpdates.sci_type_level.push(answer);
                            }
                            break;
                    }
                }

                // Update Guest record
                if (Object.keys(guestUpdates).length > 0) {
                    await guest.update(guestUpdates);
                    console.log(`   ✅ Updated guest fields: ${Object.keys(guestUpdates).join(', ')}`);
                    updatedGuestsCount++;
                }

                // Update or create HealthInfo record
                if (Object.keys(healthInfoUpdates).length > 0) {
                    let healthInfo = await HealthInfo.findOne({
                        where: { guest_id: guest.id }
                    });

                    if (healthInfo) {
                        await healthInfo.update(healthInfoUpdates);
                        console.log(`   ✅ Updated health_info fields: ${Object.keys(healthInfoUpdates).join(', ')}`);
                    } else {
                        healthInfoUpdates.guest_id = guest.id;
                        await HealthInfo.create(healthInfoUpdates);
                        console.log(`   ✅ Created health_info with fields: ${Object.keys(healthInfoUpdates).join(', ')}`);
                    }
                    updatedHealthInfoCount++;
                }

                if (Object.keys(guestUpdates).length === 0 && Object.keys(healthInfoUpdates).length === 0) {
                    console.log(`   ⊘ No profile fields found to update`);
                    skippedCount++;
                }

            } catch (error) {
                console.error(`   ❌ Error processing guest #${guest.id}:`, error.message);
                errorCount++;
            }
        }

        // Summary
        console.log('\n========================================');
        console.log('Sync Summary');
        console.log('========================================');
        console.log(`✅ Guests updated: ${updatedGuestsCount}`);
        console.log(`✅ HealthInfo records updated/created: ${updatedHealthInfoCount}`);
        console.log(`⏭️  Skipped: ${skippedCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📊 Total processed: ${guests.length}`);
        console.log('========================================\n');

        if (errorCount > 0) {
            console.log('⚠️  Some guests failed to update. Please review the errors above.');
            process.exit(1);
        } else {
            console.log('🎉 Guest profile sync completed successfully!');
        }

    } catch (error) {
        console.error('\n❌ Guest profile sync failed:', error);
        throw error;
    }
}

// Run sync if called directly
if (require.main === module) {
    syncGuestProfilesFromBookings()
        .then(() => {
            console.log('\n✅ Script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = syncGuestProfilesFromBookings;