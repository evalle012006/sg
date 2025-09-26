import { Booking, Equipment, EquipmentCategory, Guest, Log, QaPair, Section, Setting, CourseOffer, Course, sequelize } from "../../../models"
import { BookingService } from "../../../services/booking/booking";
import { dispatchHttpTaskHandler } from "../../../services/queues/dispatchHttpTask";
import StorageService from "../../../services/storage/storage";
import { QUESTION_KEYS } from "../../../services/booking/question-helper";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    const storage = new StorageService({ bucketType: "restricted" });
    const bookingService = new BookingService();

    const { qa_pairs, flags, equipmentChanges } = req.body;
    const bookingUuid = flags?.bookingUuid || null;
    const booking = await Booking.findOne({ 
        where: { 
            uuid: bookingUuid 
        },
        include: [
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
                    const qaPairToDelete = await QaPair.findOne({
                        where: {
                            question: record.question,
                            section_id: record.section_id
                        },
                        transaction
                    });

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
                        
                        const [instance, created] = await QaPair.findOrCreate({
                            where: {
                                question: record.question,
                                section_id: record.section_id
                            },
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

            courseOfferUpdated = await handleCourseOfferLinking(booking, qa_pairs, transaction);

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            console.error('Error in save-qa-pair transaction:', err);
            return res.status(500).json({ success: false, error: err });
        }

        if (booking) {
            let bookingAmended = false;
            if (equipmentChanges && equipmentChanges?.length > 0) {
                bookingService.manageBookingEquipment(booking, equipmentChanges);
                bookingAmended = true;
            }

            const updatedBooking = await updateBooking(booking, qa_pairs, flags, bookingService);
            if (bookingAmended == false) {
                bookingAmended = updatedBooking?.bookingAmended ? updatedBooking.bookingAmended : false;
            }

            return res.status(201).json({ 
                success: true, 
                bookingAmended: bookingAmended,
                courseOfferLinked: courseOfferUpdated
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
        let guestId = booking.Guest.id || null;

        if (!bookingId || !guestId) {
            console.log('⚠️ Could not determine booking or guest ID for course linking');
            return false;
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

            // Check if this is a course selection question with a valid course ID/offer ID
            if (questionKey === QUESTION_KEYS.WHICH_COURSE && answer && answer !== '' && answer !== '0') {
                console.log(`🎓 Course selection detected: ${answer}`);
                
                // The answer could be either a course_id or a course_offer_id
                // We need to check both possibilities
                const courseIdInt = parseInt(answer);
                if (isNaN(courseIdInt)) {
                    console.log('⚠️ Invalid course ID format:', answer);
                    continue;
                }

                // Strategy 1: Try to find course offer by course_offer.id (most direct)
                let courseOffer = await CourseOffer.findOne({
                    where: {
                        id: courseIdInt,
                        guest_id: guestId,
                        status: ['offered', 'accepted'], // Only link active offers
                        booking_id: null // Only link offers that aren't already linked
                    },
                    include: [{
                        model: Course,
                        as: 'course',
                        attributes: ['id', 'title']
                    }],
                    transaction
                });

                // Strategy 2: If not found by offer ID, try by course ID
                if (!courseOffer) {
                    courseOffer = await CourseOffer.findOne({
                        where: {
                            course_id: courseIdInt,
                            guest_id: guestId,
                            status: ['offered', 'accepted'],
                            booking_id: null
                        },
                        include: [{
                            model: Course,
                            as: 'course',
                            attributes: ['id', 'title']
                        }],
                        transaction
                    });
                }

                if (courseOffer) {
                    // Update the course offer to link it to this booking
                    await courseOffer.update({
                        booking_id: bookingId,
                        status: 'accepted' // Update status to accepted when linked to booking
                    }, { transaction });

                    courseOfferUpdated = true;
                    console.log(`✅ Successfully linked course offer ${courseOffer.id} (course: "${courseOffer.course.title}") to booking ${bookingId}`);
                    
                    // Log this action for audit purposes
                    await Log.create({
                        data: {
                            course_offer_id: courseOffer.id,
                            course_id: courseOffer.course_id,
                            course_title: courseOffer.course.title,
                            booking_id: bookingId,
                            guest_id: guestId,
                            action: 'course_offer_linked',
                            linked_at: new Date(),
                            question_answer: answer
                        },
                        type: 'course_offer_linked',
                        loggable_type: 'booking',
                        loggable_id: bookingId,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, { transaction });

                } else {
                    console.log(`⚠️ No linkable course offer found for course/offer ID ${courseIdInt} and guest ${guestId}`);
                    
                    // Log this for debugging
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

        const isBookingComplete = await bookingService.isBookingComplete(booking.uuid);
        console.log('isBookingComplete', isBookingComplete);
        const validResponses = qa_pairs.filter(item => 'submit' in item);
        const allSubmitted = validResponses.every(qa => qa.submit);
        
        if (isBookingComplete && (booking.complete || allSubmitted)) {
            console.log('Booking is complete');
            if (!booking.complete) {
                console.log('Updating booking to complete')
                await Booking.update({ complete: true }, { where: { id: booking.id } });
            }

            const metainfo = JSON.parse(booking.metainfo);

            let bookingAmended = false;
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
            } else if (currentBookingStatus?.name === 'pending_approval') {
                const bookingHasCourse = await bookingService.validateBookingHasCourse(booking);

                if (booking.type == 'Returning Guest' && !bookingHasCourse && !booking.status.includes('ready_to_process')) {
                    const readyToProcessStatus = bookingStatuses.find(status => JSON.parse(status.value).name == 'ready_to_process');
                    const bokkingStatusName = JSON.parse(readyToProcessStatus.value).name;
                    await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'ready_to_process')), status: readyToProcessStatus.value, status_name: bokkingStatusName }, { where: { id: booking.id } });
                    bookingService.generateBookingStatusChangeNotifications(booking, 'ready_to_process');
                }
            }

            if (metainfo.notifications == undefined || metainfo.notifications == false) {
                bookingService.generateNotifications(booking);
            }

            if (typeof metainfo.triggered_emails == 'boolean') {
                if (metainfo.triggered_emails == undefined || metainfo.triggered_emails == false) {
                    dispatchHttpTaskHandler('booking', { type: 'triggerEmails', payload: { booking_id: booking.id } });
                }
            }

            if (typeof metainfo.triggered_emails == 'object') {
                if (metainfo.triggered_emails.on_submit == undefined || metainfo.triggered_emails.on_submit == false) {
                    dispatchHttpTaskHandler('booking', { type: 'triggerEmailsOnSubmit', payload: { booking_id: booking.id } });
                }

                if ((metainfo.triggered_emails.on_booking_confirmed == undefined || metainfo.triggered_emails.on_booking_confirmed == false) && booking.status.includes('booking_confirmed')) {
                    dispatchHttpTaskHandler('booking', { type: 'triggerEmailsOnBookingConfirmed', payload: { booking_id: booking.id } });
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