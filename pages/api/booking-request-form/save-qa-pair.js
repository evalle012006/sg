import { Booking, Equipment, EquipmentCategory, Guest, Log, QaPair, Question, Section, Setting, CourseOffer, Course, sequelize, BookingEquipment, Package } from "../../../models"
import { BookingService } from "../../../services/booking/booking";
import { dispatchHttpTaskHandler } from "../../../services/queues/dispatchHttpTask";
import StorageService from "../../../services/storage/storage";
import { QUESTION_KEYS } from "../../../services/booking/question-helper";
import { BOOKING_TYPES } from "../../../components/constants";
import moment from "moment";
import { getFunder } from "../../../utilities/common";
import AuditLogService from "../../../services/AuditLogService";

// ── ADDED: safely convert any value to a display string for audit descriptions ──
// Prevents "[object Object]" when answers are objects (e.g. care-table, service-cards)
const toDisplay = (val) => {
  if (val === null || val === undefined) return 'N/A';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

// Profile field → question_key mapping for fallback ──────────────
// Keys must match question_key values in the questions table exactly.
// Source of truth: mapProfileDataToQuestions() in booking-request-form/index.js
// Only covers fields sourced directly from the Guest record (not HealthInfo).
// Phone has two possible question_keys depending on the template — both are listed;
// the backfill will write whichever one exists in this booking's sections.
const PROFILE_FIELD_TO_QUESTION_KEY = {
    first_name:             'first-name',
    last_name:              'last-name',
    email:                  'email',
    phone_number:           'mobile-no',             // alias 'phone-number' handled below
    gender:                 'gender-person-with-sci',
    dob:                    'date-of-birth-person-with-sci',
    address_street1:        'street-address',         // frontend also handles 'street-address-line-1'
    address_street2:        'street-address-line-2-optional', // frontend also handles 'street-address-line-2'
    address_city:           'city',
    address_state_province: 'state-province',
    address_postal:         'post-code',
    address_country:        'country',
};

// Some guest fields have template-variant question_keys.
// This map lists the fallback key to try if the primary key isn't found.
const PROFILE_FIELD_ALIAS_KEY = {
    phone_number:    'phone-number',
    address_street1: 'street-address-line-1',
    address_street2: 'street-address-line-2',
};

// Fallback function ───────────────────────────────────────────────
/**
 * On final submission, find any profile-mapped QaPairs that are missing or
 * empty and patch them from the guest record.
 *
 * This is a safety net for the race condition where mapProfileDataToQuestions
 * didn't apply in time on the frontend, causing First Name / Last Name etc.
 * to be absent from the qa_pairs payload sent to save-qa-pair.
 *
 * Runs in its own transaction so a failure here never blocks the submission.
 * Only touches primary guest fields — not health info.
 *
 * @param {object} booking  Fresh Booking instance with Sections → QaPairs → Question, and Guest
 */
async function backfillMissingProfileQaPairs(booking) {
    const guest = booking.Guest;
    if (!guest) {
        console.warn('⚠️ [ProfileFallback] No guest on booking — skipping');
        return;
    }

    // ── Step 1: Build answered-key set from current QaPairs (in-memory, post-commit) ──
    // This tells us which profile fields already have a saved answer and need no patch.
    const answeredKeys = new Set();
    for (const section of booking.Sections || []) {
        for (const qaPair of section.QaPairs || []) {
            const key = qaPair.Question?.question_key;
            if (!key) continue;
            if (qaPair.answer !== null && qaPair.answer !== undefined && qaPair.answer !== '') {
                answeredKeys.add(key);
            }
        }
    }

    // ── Step 2: Determine which profile fields actually need patching ─────────────
    const needed = Object.entries(PROFILE_FIELD_TO_QUESTION_KEY).filter(([guestField, questionKey]) => {
        const profileValue = guest[guestField];
        if (profileValue === null || profileValue === undefined || profileValue === '') return false;
        if (answeredKeys.has(questionKey)) return false;
        return true;
    });

    if (needed.length === 0) {
        console.log('✅ [ProfileFallback] All profile fields present — no patches needed');
        return;
    }

    // ── Step 3: Fresh targeted fetch — bridge booking sections → template questions ─
    // Data model reality:
    //   questions.section_id  → template section id  (orig_section_id on cloned sections)
    //   qa_pairs.section_id   → cloned booking section id
    //
    // So we cannot do Section.findAll(booking sections, include: [Question]) directly —
    // no question has section_id equal to a cloned section id.
    //
    // Instead: fetch booking's cloned sections to get orig_section_id values, then
    // fetch template sections by those ids to get Questions, then map back to
    // cloned section ids for QaPair writes.
    const bookingSections = await Section.findAll({
        where: { model_type: 'booking', model_id: booking.id },
        attributes: ['id', 'orig_section_id'],
    });

    // Map: orig_section_id → cloned booking section id
    const origToClonedId = new Map();
    for (const s of bookingSections) {
        if (s.orig_section_id) origToClonedId.set(s.orig_section_id, s.id);
    }

    // Fetch the template sections (by orig_section_id) with their Questions
    const origSectionIds = [...origToClonedId.keys()];
    const templateSections = origSectionIds.length > 0
        ? await Section.findAll({
            where: { id: origSectionIds },
            include: [{
                model: Question,
                attributes: ['id', 'question', 'type', 'question_key'],
            }],
        })
        : [];

    // Build a map of question_key → { sectionId (cloned), question }
    const questionKeyMap = new Map();
    for (const tmplSection of templateSections) {
        const clonedSectionId = origToClonedId.get(tmplSection.id);
        if (!clonedSectionId) continue;
        for (const question of tmplSection.Questions || []) {
            if (question.question_key && !questionKeyMap.has(question.question_key)) {
                questionKeyMap.set(question.question_key, {
                    sectionId: clonedSectionId,
                    question,
                });
            }
        }
    }

    // ── Step 4: Also fetch any existing QaPairs with empty answers for these keys ──
    // These need an UPDATE rather than a CREATE.
    const neededQuestionKeys = needed.map(([, qk]) => qk);
    const neededQuestionIds = neededQuestionKeys
        .map(qk => questionKeyMap.get(qk)?.question?.id)
        .filter(Boolean);

    // Map of question_id → existing QaPair instance (empty answer)
    const emptyQaPairMap = new Map();
    if (neededQuestionIds.length > 0) {
        const existingEmpty = await QaPair.findAll({
            where: {
                section_id: bookingSections.map(s => s.id),
                question_id: neededQuestionIds,
            },
        });
        for (const qaPair of existingEmpty) {
            emptyQaPairMap.set(qaPair.question_id, qaPair);
        }
    }

    // ── Step 5: Patch each missing field ─────────────────────────────────────────
    const patched = [];
    const skipped = [];

    for (const [guestField, questionKey] of needed) {
        const profileValue = guest[guestField];

        // Try primary key first, then alias if primary not found in this booking's template
        let entry = questionKeyMap.get(questionKey);
        if (!entry && PROFILE_FIELD_ALIAS_KEY[guestField]) {
            entry = questionKeyMap.get(PROFILE_FIELD_ALIAS_KEY[guestField]);
        }

        if (!entry) {
            // Question doesn't exist in this booking's template sections — skip
            skipped.push(questionKey);
            continue;
        }

        const { sectionId, question } = entry;

        // Format dob using moment to avoid toISOString() timezone shift
        let valueToSave;
        if (guestField === 'dob' && profileValue) {
            valueToSave = moment(profileValue).format('YYYY-MM-DD');
        } else {
            valueToSave = String(profileValue);
        }

        // Each patch in its own transaction so one failure doesn't block others
        const fallbackTransaction = await sequelize.transaction();
        try {
            const existingEmptyQaPair = emptyQaPairMap.get(question.id);

            if (existingEmptyQaPair) {
                // Row exists with empty answer — update it
                await existingEmptyQaPair.update(
                    { answer: valueToSave, updated_at: new Date() },
                    { transaction: fallbackTransaction }
                );
                console.log(`✅ [ProfileFallback] Patched empty QaPair for "${questionKey}": "${valueToSave}"`);
            } else {
                // No row at all — create one
                await QaPair.create({
                    question_id:   question.id,
                    section_id:    sectionId,
                    question:      question.question || questionKey,
                    question_type: question.type || 'text',
                    answer:        valueToSave,
                    created_at:    new Date(),
                    updated_at:    new Date(),
                }, { transaction: fallbackTransaction });
                console.log(`✅ [ProfileFallback] Created missing QaPair for "${questionKey}": "${valueToSave}"`);
            }

            await fallbackTransaction.commit();
            patched.push(questionKey);

        } catch (patchError) {
            await fallbackTransaction.rollback();
            console.error(`⚠️ [ProfileFallback] Failed to patch "${questionKey}":`, patchError);
            skipped.push(questionKey);
        }
    }

    if (patched.length > 0) console.log(`🔧 [ProfileFallback] Patched ${patched.length} field(s):`, patched);
    if (skipped.length > 0) console.log(`⏭️  [ProfileFallback] Skipped ${skipped.length} field(s):`, skipped);
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const storage = new StorageService({ bucketType: "restricted" });
    const bookingService = new BookingService();

    const { qa_pairs, flags, equipmentChanges } = req.body;
    const bookingUuid = flags?.bookingUuid || null;

    // Added Question to the initial QaPair include so question_key
    //             is available throughout the handler (needed by fallback + any
    //             existing code that reads qaPair.Question?.question_key) ──────
    const booking = await Booking.findOne({ 
        where: { 
            uuid: bookingUuid 
        },
        include: [
            {
                model: Section,
                include: [{
                    model: QaPair,
                    include: [Question]
                }]
            },
            Guest,
            {
                model: Equipment,
                include: [EquipmentCategory]
            }
        ]
    });

    if (req.method === "POST") {
        const transaction = await sequelize.transaction();
        const response = [];
        let courseOfferUpdated = false;

        try {
            for (const record of qa_pairs) {
                if (record.question_type == 'equipment') {
                    continue;
                }

                if (record.hasOwnProperty('delete') && record.delete === true) {
                    let qaPairToDelete;
                    if (record.id) {
                        qaPairToDelete = await QaPair.findByPk(record.id, { transaction });
                    } else if (record.question_id) {
                        qaPairToDelete = await QaPair.findOne({
                            where: { question_id: record.question_id, section_id: record.section_id },
                            transaction
                        });
                    } else {
                        // Legacy fallback only — no question_id present
                        qaPairToDelete = await QaPair.findOne({
                            where: { question: record.question, section_id: record.section_id },
                            transaction
                        });
                    }

                    if (qaPairToDelete) {
                        await qaPairToDelete.destroy({ transaction });

                        if (record.question_type == 'file-upload') {
                            const filename = record.oldAnswer;
                            const filepath = 'booking_request_form/' + record.guestId + "/";
                            try {
                                await storage.deleteFile(filepath, filename);
                            } catch (error) {
                                if (error.code == 404){
                                    console.log("File not found");
                                }
                                console.error("Error deleting file:", error);
                            }
                        }
                    }
                    continue;
                } else {
                    if (record.id) {
                        // UPDATE existing record by ID
                        console.log(`Updating existing qa_pair with ID: ${record.id}`);
                        
                        // First try to find the existing record
                        const existingRecord = await QaPair.findByPk(record.id, { transaction });
                        
                        if (existingRecord) {
                            // Update the existing record
                            await existingRecord.update({
                                answer: record.answer,
                                updated_at: new Date(),
                            }, { transaction });
                            
                            response.push(existingRecord);
                            console.log(`Successfully updated qa_pair ID: ${record.id}`);
                        } else {
                            // Record doesn't exist with this ID, create new one without the ID
                            console.warn(`No record found with ID: ${record.id}, creating new record`);
                            const newRecord = { ...record };
                            delete newRecord.id; // Remove ID to let database auto-generate
                            
                            const instance = await QaPair.create(newRecord, { transaction });
                            response.push(instance);
                        }
                    } else {
                        // CREATE new record using findOrCreate (no ID provided)
                        console.log(`Creating/finding qa_pair: ${record.question}`);
                        
                        // Create defaults object without the id field
                        const defaults = { ...record };
                        delete defaults.id; // Ensure no ID is passed to defaults
                        
                        const findOrCreateWhere = record.question_id
                            ? { question_id: record.question_id, section_id: record.section_id }
                            : { question: record.question, section_id: record.section_id };

                        const [instance, created] = await QaPair.findOrCreate({
                            where: findOrCreateWhere,
                            defaults: defaults,
                            transaction,
                        });
        
                        if (!created) {
                            // Update the existing record if needed
                            await instance.update(defaults, { transaction });
                        }
                        response.push(instance);
                    }
                }
            }
            await transaction.commit();
            console.log('✅ QA pairs transaction committed successfully');

            // ⭐⭐⭐ ADMIN FIELD CHANGES AUDIT LOG ⭐⭐⭐
            // Track ALL admin changes immediately, even single field edits
            // DO NOT track guest field changes here (only on submission)
            if (flags?.origin === 'admin' && booking) {
                try {
                    for (const record of qa_pairs) {
                        // Skip deletions and new fields without old answers
                        if (record.delete || !record.hasOwnProperty('oldAnswer')) {
                            continue;
                        }
                        
                        // Only log if answer actually changed
                        if (record.answer !== record.oldAnswer) {
                            await AuditLogService.createAuditEntry({
                                bookingId: booking.id,
                                userId: flags.currentUserId,
                                guestId: null,
                                actionType: 'admin_note_added',
                                userType: 'admin',
                                description: `${record.question}: ~~${toDisplay(record.oldAnswer)}~~ → ${toDisplay(record.answer)}`,
                                oldValue: { 
                                    question: record.question,
                                    answer: record.oldAnswer,
                                    question_type: record.question_type
                                },
                                newValue: { 
                                    question: record.question,
                                    answer: record.answer,
                                    question_type: record.question_type
                                },
                                category: record.sectionLabel || 'Admin Edit',
                                metadata: {
                                    question_type: record.question_type,
                                    section_label: record.sectionLabel,
                                    edited_at: new Date(),
                                    field_id: record.id || record.question_id
                                }
                            });
                        }
                    }
                    console.log('✅ Admin field changes logged to audit trail');
                } catch (auditError) {
                    console.error('⚠️ Failed to log admin field changes:', auditError);
                }
            }
        } catch (err) {
            await transaction.rollback();
            console.error('Error in save-qa-pair transaction:', err);
            return res.status(500).json({ success: false, error: err });
        }

        if (booking) {
            courseOfferUpdated = await handleCourseOfferLinking(booking, qa_pairs, transaction);

            let bookingAmended = false;
            if (equipmentChanges && equipmentChanges?.length > 0) {
                bookingService.manageBookingEquipment(booking, equipmentChanges);
                bookingAmended = true;
            }

            const updatedBooking = await updateBooking(booking, qa_pairs, flags, bookingService);
            if (bookingAmended == false) {
                bookingAmended = updatedBooking?.bookingAmended ? updatedBooking.bookingAmended : false;
            }

            // Check equipment completion status after save
            let completedEquipments = false;
            const bookingType = booking.type;
            
            if (bookingType === BOOKING_TYPES.FIRST_TIME_GUEST) {
                // For first-time guests, any equipment saved = complete
                const bookingEquipments = await BookingEquipment.findAll({ 
                    where: { booking_id: booking.id } 
                });
                completedEquipments = bookingEquipments.length > 0;
            } else {
                // For returning guests, check for acknowledgement-type equipments specifically
                const acknowledgementEquipments = await BookingEquipment.findAll({ 
                    where: { booking_id: booking.id },
                    include: [{
                        model: Equipment,
                        where: { type: 'acknowledgement' },
                        required: true
                    }]
                });
                
                completedEquipments = acknowledgementEquipments.length > 0;
            }

            return res.status(201).json({ 
                success: true, 
                bookingAmended: bookingAmended,
                courseOfferLinked: courseOfferUpdated,
                emailTriggersQueued: true,
                completedEquipments: completedEquipments
            });
        }

        return res.status(400).json({ success: false, error: "No valid QA pairs processed or bookingId was not found or null" });
    }
}

/**
 * Handle linking course offers to bookings when course selections are made
 */
async function handleCourseOfferLinking(booking, qa_pairs, transaction) {
    try {
        console.log('🎓 Checking for course selection answers to link with offers...');

        let courseOfferUpdated = false;
        let bookingId = booking.id || null;
        let guestId = booking && booking.Guest ? booking.Guest.id : null;

        if (!bookingId || !guestId) {
            console.log('⚠️ Could not determine booking or guest ID for course linking');
            return false;
        }

        // ── Pre-pass: unlink offer if guest answered "No" to course offer question ──
        const courseOfferNo = qa_pairs.find(
            p => p.question_key === QUESTION_KEYS.COURSE_OFFER_QUESTION &&
                 p.answer?.toLowerCase() !== 'yes'
        );
        if (courseOfferNo) {
            // Guest removed their course intent — release any accepted offer tied to this booking
            const linkedOffers = await CourseOffer.findAll({
                where: { booking_id: bookingId, status: 'accepted' },
                transaction
            });
            for (const lo of linkedOffers) {
                await lo.update({ booking_id: null, status: 'offered' }, { transaction });
                console.log(`↩️ Released course offer ${lo.id} back to 'offered' (guest answered No)`);
            }
        }

        // Check for course-related questions in the QA pairs
        for (const qaPair of qa_pairs) {
            const questionKey = qaPair.question_key;
            const answer = qaPair.answer;

            // Check if this is a course offer question with "Yes" answer
            if (questionKey === QUESTION_KEYS.COURSE_OFFER_QUESTION && answer?.toLowerCase() === 'yes') {
                console.log('✅ Course offer question answered "Yes"');
                continue; // This just indicates they want to participate, actual linking happens on course selection
            }

            // Check if this is a course selection question (where they pick actual courses)
            if (questionKey === QUESTION_KEYS.COURSE_SELECTION_QUESTION && answer) {
                console.log('🎯 Course selection detected:', answer);

                // Answer could be a single course ID or comma-separated list
                const courseIds = answer.toString().split(',').map(id => id.trim());

                for (const courseIdStr of courseIds) {
                    const courseIdInt = parseInt(courseIdStr, 10);

                    if (isNaN(courseIdInt)) {
                        console.log(`⚠️ Invalid course ID: ${courseIdStr}`);
                        continue;
                    }

                    console.log(`🔍 Looking for course offer with course_id: ${courseIdInt}, guest_id: ${guestId}`);

                    // Find the matching course offer for this guest and course
                    const courseOffer = await CourseOffer.findOne({
                        where: {
                            course_id: courseIdInt,
                            guest_id: guestId
                        },
                        include: [Course]
                    });

                    if (courseOffer) {
                        // Check if already linked to a different booking
                        if (courseOffer.booking_id && courseOffer.booking_id !== bookingId) {
                            console.log(`⚠️ Course offer ${courseOffer.id} already linked to booking ${courseOffer.booking_id}`);
                            
                            // Log this situation
                            await Log.create({
                                data: {
                                    course_offer_id: courseOffer.id,
                                    course_id: courseIdInt,
                                    current_booking_id: courseOffer.booking_id,
                                    attempted_booking_id: bookingId,
                                    action: 'course_offer_already_linked'
                                },
                                type: 'course_offer_conflict',
                                loggable_type: 'booking',
                                loggable_id: bookingId,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }, { transaction });

                            continue; // Skip this one
                        }

                        // Link the course offer to this booking and auto-accept if still offered
                        const wasOffered = courseOffer.status === 'offered';
                        await courseOffer.update({
                            booking_id: bookingId,
                            ...(wasOffered ? { status: 'accepted' } : {})
                        }, { transaction });

                        console.log(`✅ Successfully linked course offer ${courseOffer.id} to booking ${bookingId}${wasOffered ? ' (auto-accepted)' : ''}`);
                        
                        // Log the successful linking
                        await Log.create({
                            data: {
                                course_offer_id: courseOffer.id,
                                course_id: courseIdInt,
                                course_name: courseOffer.Course ? courseOffer.Course.name : 'Unknown',
                                booking_id: bookingId,
                                guest_id: guestId,
                                action: 'course_offer_linked',
                                linked_at: new Date()
                            },
                            type: 'course_offer_linked',
                            loggable_type: 'booking',
                            loggable_id: bookingId,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }, { transaction });

                        courseOfferUpdated = true;
                    } else {
                        console.log(`⚠️ No course offer found for course_id: ${courseIdInt}, guest_id: ${guestId}`);
                        
                        // Log that no matching offer was found
                        await Log.create({
                            data: {
                                attempted_course_id: courseIdInt,
                                booking_id: bookingId,
                                guest_id: guestId,
                                action: 'course_offer_link_failed',
                                reason: 'no_matching_offer',
                                attempted_at: new Date(),
                                question_answer: answer
                            },
                            type: 'course_offer_link_failed',
                            loggable_type: 'booking',
                            loggable_id: bookingId,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }, { transaction });
                    }
                }
            }
        }

        return courseOfferUpdated;
        
    } catch (error) {
        console.error('❌ Error in handleCourseOfferLinking:', error);
        throw error; // Re-throw to be caught by main transaction
    }
}

const updateBooking = async (booking, qa_pairs = [], flags, bookingService) => {
    let response = { bookingAmended: false };
    if (booking) {
        const bookingStatuses = await Setting.findAll({ where: { attribute: 'booking_status' } });
        let statusLogs = booking.status_logs ? JSON.parse(booking.status_logs) : [];
        const currentBookingStatus = booking.status ? JSON.parse(booking.status) : null;
        bookingService.disseminateChanges(booking, qa_pairs);

        // Profile fallback runs before isBookingComplete ─────────
        // Determine allSubmitted early so we can conditionally run the fallback.
        // This mirrors the same check done below — no logic change to the
        // original allSubmitted behaviour.
        const validResponsesEarly = qa_pairs.filter(item => 'submit' in item);
        const allSubmittedEarly = validResponsesEarly.every(qa => qa.submit);

        if (allSubmittedEarly) {
            try {
                await backfillMissingProfileQaPairs(booking);

                // Reload sections with fresh QaPairs so isBookingCompleteFromBooking
                // sees the rows just written by the backfill. The initial booking
                // object is pre-transaction and won't reflect newly created QaPairs.
                const freshSections = await Section.findAll({
                    where: { model_type: 'booking', model_id: booking.id },
                    include: [{ model: QaPair, include: [Question] }],
                });
                booking.Sections = freshSections;
            } catch (fallbackError) {
                // Non-fatal: log and continue — submission must never be blocked
                console.error('⚠️ [ProfileFallback] Unexpected error — submission unaffected:', fallbackError);
            }
        }

        const incompleteQuestions = [];
        const isBookingComplete = await bookingService.isBookingCompleteFromBooking(booking, incompleteQuestions);
        console.log('isBookingComplete', isBookingComplete);
        const validResponses = qa_pairs.filter(item => 'submit' in item);
        const allSubmitted = validResponses.every(qa => qa.submit);

        // Audit-log any incomplete required questions at the point of submission
        if (allSubmitted && incompleteQuestions.length > 0) {
            try {
                await AuditLogService.createAuditEntry({
                    bookingId: booking.id,
                    userId: null,
                    guestId: flags?.currentUserId || booking.guest_id,
                    actionType: 'booking_submitted',
                    userType: 'guest',
                    description: `Booking submitted with ${incompleteQuestions.length} incomplete required question(s)`,
                    oldValue: null,
                    newValue: { incomplete_questions: incompleteQuestions },
                    category: 'Validation',
                    metadata: {
                        submitted_at: new Date(),
                        is_complete: isBookingComplete,
                        incomplete_count: incompleteQuestions.length,
                        incomplete_questions: incompleteQuestions
                    }
                });
                console.log(`⚠️ Logged ${incompleteQuestions.length} incomplete questions to audit trail`);
            } catch (auditError) {
                console.error('⚠️ Failed to log incomplete questions audit:', auditError);
            }
        }
        
        if (isBookingComplete && (booking.complete || allSubmitted)) {
            console.log('Booking is complete');
            
            if (!booking.complete) {
                console.log('Updating booking to complete')
                await Booking.update({ complete: true }, { where: { id: booking.id } });
                
                // ⭐⭐⭐ GUEST SUBMISSION AUDIT LOG ⭐⭐⭐
                // ONLY log guest submissions when they complete the entire form
                // DO NOT log admin submissions here (they're tracked elsewhere)
                try {
                    const isAdminOrigin = flags?.origin === 'admin';
                    
                    // Only for guests AND only on final submission
                    if (!isAdminOrigin && allSubmitted) {
                        await AuditLogService.createAuditEntry({
                            bookingId: booking.id,
                            userId: null,
                            guestId: flags.currentUserId || booking.guestId, // Use current user ID if available, otherwise fallback to guest ID
                            actionType: 'booking_submitted',
                            userType: 'guest',
                            description: 'Booking request submitted for review',
                            oldValue: { status: 'draft', complete: false },
                            newValue: { status: 'submitted', complete: true },
                            category: 'Submission',
                            metadata: {
                                submitted_at: new Date(),
                                booking_type: booking.type
                            }
                        });
                        console.log('✅ Guest booking submission logged to audit trail');
                    }
                } catch (auditError) {
                    console.error('⚠️ Failed to create submission audit log:', auditError);
                }
            }

            const metainfo = JSON.parse(booking.metainfo);
            let bookingAmended = false;
            
            if (currentBookingStatus?.name === 'booking_confirmed') {
                console.log('Booking is confirmed, checking for amendments...');
                // Check if booking dates are in the past
                const isBookingInPast = () => {
                    // Use check_out_date first, fallback to preferred_departure_date
                    const checkoutDate = booking.check_out_date || booking.preferred_departure_date;
                    
                    if (!checkoutDate) {
                        console.log('⚠️ No checkout date found for booking');
                        return false; // If no date, allow amendments
                    }
                    
                    const checkout = moment(checkoutDate);
                    const now = moment();
                    
                    return checkout.isBefore(now, 'day');
                };

                const bookingInPast = isBookingInPast();
                const isAdminOrigin = flags?.origin && flags.origin === 'admin';
                console.log(`Amendment attempt - bookingInPast: ${bookingInPast}, isAdminOrigin: ${isAdminOrigin}`);
                
                // Only process amendments if:
                // 1. Booking is NOT in the past, OR
                // 2. Changes are from admin (admins can amend past bookings)
                if (!bookingInPast || isAdminOrigin) {
                    console.log(`✅ Amendment validation passed - bookingInPast: ${bookingInPast}, isAdmin: ${isAdminOrigin}`);
                    
                    for (const qaPair of qa_pairs) {
                        if (qaPair.hasOwnProperty('dirty') && qaPair.dirty == true && (qaPair.answer != qaPair.oldAnswer)) {
                            let data = {
                                approved: false,
                                approved_by: null,
                                approval_date: null,
                                qa_pair: {
                                    id: qaPair?.id,
                                    sectionLabel: qaPair?.sectionLabel,
                                    question: qaPair.question,
                                    answer: qaPair.answer,
                                    question_type: qaPair.question_type,
                                    oldAnswer: qaPair.oldAnswer
                                }
                            }

                            if (flags?.origin && flags.origin == 'admin') {
                                data.modifiedBy = 'admin';
                                data.modifiedDate = new Date();
                                data.approved_by = 'admin';
                                data.approved = true;
                                data.approval_date = new Date();
                            }

                            const whereClause = {
                                loggable_id: booking.id,
                                loggable_type: 'booking',
                                'data.approved': false,
                            };

                            if (qaPair?.id) {
                                whereClause['data.qa_pair.id'] = qaPair.id;
                            } else {
                                whereClause['data.qa_pair.question'] = qaPair.question;
                                whereClause['data.qa_pair.question_type'] = qaPair.question_type;
                            }

                            const logExists = await Log.findOne({
                                where: whereClause
                            });

                            if (logExists) {
                                logExists.update({
                                    data
                                });
                            } else {
                                await Log.create({
                                    data,
                                    type: 'qa_pair',
                                    loggable_type: 'booking',
                                    loggable_id: booking.id,
                                    createdAt: new Date(),
                                    updatedAt: new Date()
                                });
                            }

                            bookingAmended = true;

                            // ⭐⭐⭐ AMENDMENT AUDIT LOG ⭐⭐⭐
                            // Admin: Track ALL changes immediately
                            // Guest: Only track changes to confirmed bookings
                            try {
                                const isAdminOrigin = flags?.origin === 'admin';
                                const userType = isAdminOrigin ? 'admin' : 'guest';
                                
                                // Log the amendment to audit trail
                                await AuditLogService.createAuditEntry({
                                    bookingId: booking.id,
                                    userId: isAdminOrigin ? flags.currentUserId : null,
                                    guestId: isAdminOrigin ? null : flags.currentUserId,
                                    actionType: isAdminOrigin ? 'admin_note_added' : 'amendment_submitted',
                                    userType: userType,
                                    // ── CHANGED: use toDisplay() to prevent [object Object] ──
                                    description: `${qaPair.question}: ~~${toDisplay(qaPair.oldAnswer)}~~ → ${toDisplay(qaPair.answer)}`,
                                    oldValue: { 
                                        question: qaPair.question,
                                        answer: qaPair.oldAnswer,
                                        question_type: qaPair.question_type
                                    },
                                    newValue: { 
                                        question: qaPair.question,
                                        answer: qaPair.answer,
                                        question_type: qaPair.question_type
                                    },
                                    category: qaPair.sectionLabel || 'Field Update',
                                    metadata: {
                                        question_type: qaPair.question_type,
                                        section_label: qaPair.sectionLabel,
                                        modified_by: userType,
                                        auto_approved: isAdminOrigin,
                                        booking_status: currentBookingStatus?.name
                                    }
                                });
                                
                                console.log(`✅ ${userType} amendment logged to audit trail`);
                            } catch (auditError) {
                                console.error('⚠️ Failed to create amendment audit log:', auditError);
                            }
                        }
                    }
                } else {
                    console.log(`🚫 Amendment blocked - booking is in the past (checkout: ${booking.check_out_date || booking.preferred_departure_date})`);
                }
            }

            console.log('bookingAmended: ', bookingAmended)
            response.bookingAmended = bookingAmended;

            if (bookingAmended && !flags?.hasOwnProperty('origin') && flags.origin != 'admin') {
                if (currentBookingStatus?.name == 'booking_confirmed') {
                    bookingService.sendBookingEmail('amendment', booking);
                }

                const bookingAmendedStatus = bookingStatuses.find(status => JSON.parse(status.value).name == 'booking_amended');
                const bokkingStatusName = JSON.parse(bookingAmendedStatus.value).name;
                await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'booking_amended')), status: bookingAmendedStatus.value, status_name: bokkingStatusName }, { where: { id: booking.id } });
            } else if (currentBookingStatus?.name === 'pending_approval' || currentBookingStatus?.name == 'ready_to_process') {
                const bookingHasCourse = await bookingService.validateBookingHasCourse(booking);
                const bookingFunder = getFunder(booking.Sections);
                const funderLower = bookingFunder ? bookingFunder.toLowerCase() : '';
                const isBlockedFunder = funderLower === 'sargood-foundation' || 
                                        funderLower === 'sargood foundation' || 
                                        funderLower === 'ndis' || 
                                        funderLower.includes('ndia') || 
                                        funderLower.includes('ndis') || 
                                        funderLower.includes('sargood');

                if (booking.type == BOOKING_TYPES.RETURNING_GUEST && !bookingHasCourse && !booking.status.includes('ready_to_process') && !isBlockedFunder) {
                    const readyToProcessStatus = bookingStatuses.find(status => JSON.parse(status.value).name == 'ready_to_process');
                    const bokkingStatusName = JSON.parse(readyToProcessStatus.value).name;
                    await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'ready_to_process')), status: readyToProcessStatus.value, status_name: bokkingStatusName }, { where: { id: booking.id } });
                    bookingService.generateBookingStatusChangeNotifications(booking, 'ready_to_process');
                }
            }

            if (metainfo.notifications == undefined || metainfo.notifications == false) {
                bookingService.generateNotifications(booking);
            }

            let completeBooking = null;

            // Check if we need to trigger any emails
            const needsEmailTriggers = 
                (typeof metainfo.triggered_emails == 'boolean' && (metainfo.triggered_emails == undefined || metainfo.triggered_emails == false)) ||
                (typeof metainfo.triggered_emails == 'object' && (
                    (metainfo.triggered_emails.on_submit == undefined || metainfo.triggered_emails.on_submit == false) ||
                    ((metainfo.triggered_emails.on_booking_confirmed == undefined || metainfo.triggered_emails.on_booking_confirmed == false) && booking.status.includes('booking_confirmed'))
                ));

            // Fetch complete booking with relations ONCE if needed for email triggers
            if (needsEmailTriggers) {
                completeBooking = await Booking.findOne({
                    where: { id: booking.id },
                    include: [
                        Guest,
                        {
                            model: Section,
                            include: [QaPair]
                        }
                    ]
                });
            }

            if (completeBooking) {
                console.log('📧 Evaluating email triggers for booking ID:', completeBooking.id);
                if (typeof metainfo.triggered_emails == 'boolean') {
                    if (metainfo.triggered_emails == undefined || metainfo.triggered_emails == false) {
                        console.log('📧 Queueing email triggers (boolean mode)...');
                        
                        // Queue the work asynchronously
                        dispatchHttpTaskHandler('booking', { 
                            type: 'evaluateEmailTriggers', 
                            payload: { 
                                booking_id: booking.id,
                                context: 'default'
                            } 
                        });
                        
                        // Mark as triggered immediately (will be processed async)
                        metainfo.triggered_emails = true;
                        await Booking.update(
                            { metainfo: JSON.stringify(metainfo) },
                            { where: { id: booking.id } }
                        );
                    }
                }

                if (typeof metainfo.triggered_emails == 'object') {
                    if (metainfo.triggered_emails.on_submit == undefined || metainfo.triggered_emails.on_submit == false) {
                        console.log('📧 Queueing email triggers on submit...');
                        
                        dispatchHttpTaskHandler('booking', { 
                            type: 'evaluateEmailTriggers', 
                            payload: { 
                                booking_id: booking.id,
                                context: 'on_submit'
                            } 
                        });
                        
                        metainfo.triggered_emails.on_submit = true;
                        await Booking.update(
                            { metainfo: JSON.stringify(metainfo) },
                            { where: { id: booking.id } }
                        );
                    }

                    if ((metainfo.triggered_emails.on_booking_confirmed == undefined || metainfo.triggered_emails.on_booking_confirmed == false) && booking.status.includes('booking_confirmed')) {
                        console.log('📧 Queueing email triggers on booking confirmed...');
                        
                        dispatchHttpTaskHandler('booking', { 
                            type: 'evaluateEmailTriggers', 
                            payload: { 
                                booking_id: booking.id,
                                context: 'on_booking_confirmed'
                            } 
                        });
                        
                        metainfo.triggered_emails.on_booking_confirmed = true;
                        await Booking.update(
                            { metainfo: JSON.stringify(metainfo) },
                            { where: { id: booking.id } }
                        );
                    }
                }
            }

            dispatchHttpTaskHandler('booking', { type: 'generatePDFExport', payload: { booking_id: booking.id } });

            return response;
        }
    }
}

const updateStatusLogs = (statusLogs, newStatus) => {
    const currentLogs = Array.isArray(statusLogs) ? statusLogs : [];
    let updatedStatusLogs = [...currentLogs];
    let lastStatusLog = currentLogs.length > 0 ? currentLogs[currentLogs.length - 1] : null;
    if (lastStatusLog && lastStatusLog.status === newStatus) {
        updatedStatusLogs[currentLogs.length - 1] = {
            ...lastStatusLog,
            updated_at: new Date()
        };
    } else {
        updatedStatusLogs.push({
            status: newStatus,
            created_at: new Date()
        });
    }
    
    return updatedStatusLogs;
}