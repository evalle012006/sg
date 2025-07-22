import { Booking, Checklist, Guest, NotificationLibrary, Page, QaPair, Question, Section, Setting, Template, sequelize } from "../../../../models";
import { Op } from "sequelize";
import moment from 'moment';
import { NotificationService } from "../../../../services/notification/notification";
import { generateReferenceId } from "../../../../utilities/bookings";

export default async function handler(request, response) {
    const data = JSON.parse(request.body);
    const bookingStatuses = await Setting.findAll({ where: { attribute: 'booking_status' } });
    const eligibilityStatuses = await Setting.findAll({ where: { attribute: 'booking_eligibility' } });

    const transaction = await sequelize.transaction()

    try {
        const pendingEligibility = eligibilityStatuses.find(status => JSON.parse(status.value).name === 'pending_eligibility');
        const pendingApprovalStatus = bookingStatuses.find(status => JSON.parse(status.value).name === 'pending_approval');
        // const newStatus = '{"name":"incomplete","label":"Incomplete","color":"transparent"}';
        
        const notificationLibs = await NotificationLibrary.findOne({ where: {[Op.or]: [ {name: 'New Booking'}, {name: 'New Guest'} ], enabled: true} }, { transaction });
        const notificationService = new NotificationService();
        const guest = await Guest.create(data, { transaction });

        const uniqueReferenceId = await generateReferenceId();

        const booking = await Booking.create({
            ...data,
            guest_id: guest.id,
            reference_id: uniqueReferenceId,
            preffered_arrival_date: new Date(data.preffered_arrival_date),
            preffered_departure_date: new Date(data.preffered_departure_date),
            status: pendingApprovalStatus.value,
            eligibility: pendingEligibility.value,
            type: 'Enquiry',
        }, { transaction });

        const defaultTemplateSetting = await Setting.findOne({ where: { attribute: 'default_template' }, plain: true }, { transaction });
        const defaultTemplate = await Template.findOne({ where: { id: defaultTemplateSetting.value }, include: [{ model: Page, include: [{ model: Section, include: [Question] }] }], plain: true }, { transaction });

        const guestAndRoomPage = defaultTemplate.Pages.find(page => page.title === 'Date and Room Options');

        if (guestAndRoomPage) {
            const checkInCheckOutSection = guestAndRoomPage.Sections.find(section => section.Questions.some(question => question.question == 'Check In Date and Check Out Date' || question.question == 'Check In Date' || question.question == 'Check Out Date'));

            if (checkInCheckOutSection) {
                // const checkInQuestion = checkInCheckOutSection.Questions.find(question => question.question == 'Check In Date');
                // const checkOutQuestion = checkInCheckOutSection.Questions.find(question => question.question == 'Check Out Date');
                // const checkInOutQuestion = checkInCheckOutSection.Questions.find(question => question.question == 'Check In Date and Check Out Date');
                const arrivalTimeQuestion = checkInCheckOutSection.Questions.find(question => question.question == 'Do you need to check in after 5PM?');
                const [newSection, created] = await Section.upsert({
                    model_type: 'booking',
                    model_id: booking.id,
                    type: checkInCheckOutSection.type,
                    order: checkInCheckOutSection.order,
                    orig_section_id: checkInCheckOutSection.id,
                    created_at: new Date(),
                    updated_at: new Date(),
                }, { transaction });

                // if (checkInOutQuestion && created) {
                //     await QaPair.upsert({
                //         question: checkInOutQuestion.question,
                //         answer: moment(data.preffered_arrival_date).format(),
                //         question_type: checkInOutQuestion.type,
                //         question_id: checkInOutQuestion.id,
                //         section_id: newSection.id,
                //         created_at: new Date(),
                //         updated_at: new Date(),
                //     });
                // }

                if (arrivalTimeQuestion && created) {
                    await QaPair.upsert({
                        question: arrivalTimeQuestion.question,
                        question_type: arrivalTimeQuestion.type,
                        question_id: arrivalTimeQuestion.id,
                        section_id: newSection.id,
                        created_at: new Date(),
                        updated_at: new Date(),
                    },{ transaction });
                }

            }
        }

        // TODO - checklist template needs to be refactored
        const checklistTemplate = await Setting.findOne({ where: { attribute: 'default_checklist' }, raw: true }, { transaction });
        await Checklist.update({ booking_id: booking.id }, { where: { id: checklistTemplate.value } }, { transaction });

        await transaction.commit();

        for (let index = 0; index < notificationLibs.length; index++) {
            const lib = notificationLibs[index];
            let message = lib.notification;

            const notificationLink = process.env.APP_URL + '/bookings/' + booking.uuid;

            message = message.replace('[guest_name]', `${guest.first_name} ${guest.last_name}`);
            message = message.replace('[booking_id]', booking.reference_id);
            message = message.replace('[arrival_date]', moment(booking.preffered_arrival_date).format('DD-MM-YYYY'));

            const dispatch_date = moment().add(lib.date_factor, 'days').toDate();
            await notificationService.notificationHandler({
                notification_to: lib.notification_to,
                message: message,
                link: notificationLink,
                dispatch_date: dispatch_date
            });
        }
    } catch (error) {
        let message = error.errors ? { error: error.errors.map(e => e.message)[0], type: error.errors.map(e => e.type)[0] } : { error: "Something went wrong", type: "error" };
        response.status(403).json(message);
        console.log('ERROR MESSAGE FROM SQUELIZE', error);
        await transaction.rollback();
    }
    response.status(200).end();
}