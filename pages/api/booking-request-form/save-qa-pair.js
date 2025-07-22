import { Booking, Equipment, EquipmentCategory, Guest, Log, QaPair, Section, Setting, sequelize } from "../../../models"
import { BookingService } from "../../../services/booking/booking";
import { dispatchHttpTaskHandler } from "../../../services/queues/dispatchHttpTask";
import StorageService from "../../../services/storage/storage";

export default async function handler(req, res) {
    const storage = new StorageService({ bucketType: "restricted" });
    const { qa_pairs, flags, equipmentChanges } = req.body;

    if (req.method === "POST") {
        if (qa_pairs.length === 0) {
            return res.status(201).json({ success: true });
        }

        const transaction = await sequelize.transaction();
        const response = [];
        let hasEquipment = false;
        try {
            for (const record of qa_pairs) {
                if (record.question_type == 'equipment') {
                    hasEquipment = true;
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
                    const [instance, created] = await QaPair.findOrCreate({
                        where: {
                            question: record.question,
                            section_id: record.section_id
                        },
                        defaults: record,
                        transaction,
                    });
    
                    if (!created) {
                        // Update the existing record if needed
                        await instance.update(record, { transaction });
                    }
                    response.push(instance);
                }
            }
            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            return res.status(500).json({ success: false, error: err });
        }

        if (response) {
            const bookingService = new BookingService();

            if (response.length > 0 && response[0]?.id) {
                const tempQaPair = await QaPair.findOne({ where: { id: response[0].id }, include: [Section], plain: true });

                if (tempQaPair.Section.model_type == 'booking') {
                    const booking = await Booking.findOne({ 
                        where: { 
                            id: tempQaPair.Section.model_id 
                        },
                        include: [
                            Guest,
                            {
                                model: Equipment,
                                include: [EquipmentCategory]
                            }
                        ]
                    });

                    const response = await updateBooking(booking, qa_pairs, flags, bookingService);

                    return res.status(201).json({ success: true, bookingAmended: response?.bookingAmended ? response.bookingAmended : false });
                }
            } else if (hasEquipment && equipmentChanges?.length > 0) {
                const tempSection = await Section.findOne({ where: { id: qa_pairs[0].section_id } });
                if (tempSection.model_type == 'booking') {
                    const booking = await Booking.findOne({ 
                        where: { 
                            id: tempSection.model_id 
                        },
                        include: [
                            Guest,
                            {
                                model: Equipment,
                                include: [EquipmentCategory]
                            }
                        ]
                    });

                    if (booking) {
                        bookingService.manageBookingEquipment(booking, equipmentChanges);

                        await updateBooking(booking, qa_pairs, flags, bookingService);

                        return res.status(201).json({ success: true, bookingAmended: true });
                    }
                }
            }

            return res.status(201).json({ success: true, bookingAmended: false });
        }

        return res.status(400);
    }
}

const updateBooking = async (booking, qa_pairs, flags, bookingService) => {
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
        // console.log(validResponses, allSubmitted)
        if (isBookingComplete && (booking.complete || allSubmitted)) {
            // console.log('Booking is complete');
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
            // if (!flags?.hasOwnProperty('origin') && flags.origin != 'admin') {
                if (bookingAmended && !flags?.hasOwnProperty('origin') && flags.origin != 'admin') {
                    // trigger only if the previous status was confirmed
                    if (currentBookingStatus?.name == 'booking_confirmed') {
                        bookingService.sendBookingEmail('amendment', booking);
                    }

                    // await booking.reload();
                    // if (await bookingService.validateBookingHasCourse(booking)) {
                    //     const pendingApprovalStatus = bookingStatuses.find(status => JSON.parse(status.value).name == 'pending_approval');
                    //     await Booking.update({ status: pendingApprovalStatus.value }, { where: { id: booking.id } });
                    //     bookingService.generateBookingStatusChangeNotifications(booking, 'pending approval');
                    // } else {
                    const bookingAmendedStatus = bookingStatuses.find(status => JSON.parse(status.value).name == 'booking_amended');
                    const bokkingStatusName = JSON.parse(bookingAmendedStatus.value).name;
                    await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'booking_amended')), status: bookingAmendedStatus.value, status_name: bokkingStatusName }, { where: { id: booking.id } });
                    // }
                } else if (currentBookingStatus?.name === 'pending_approval') {
                    // validate if the booking has a course and change the status to ready_to_process only for returning guests
                    // all other scenarios will be pending approval for both new and returning guests when the booking is completed.
                    const bookingHasCourse = await bookingService.validateBookingHasCourse(booking);

                    if (booking.type == 'Returning Guest' && !bookingHasCourse && !booking.status.includes('ready_to_process')) {
                        const readyToProcessStatus = bookingStatuses.find(status => JSON.parse(status.value).name == 'ready_to_process');
                        const bokkingStatusName = JSON.parse(readyToProcessStatus.value).name;
                        await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'ready_to_process')), status: readyToProcessStatus.value, status_name: bokkingStatusName }, { where: { id: booking.id } });
                        bookingService.generateBookingStatusChangeNotifications(booking, 'ready_to_process');
                    }
                }
            // }

            // bookingService.triggerEmailsOnSubmit(booking);

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