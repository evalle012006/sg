import { Booking, BookingEquipment, EmailTrigger, Equipment, EquipmentCategory, Guest, Log, Page, QaPair, Question, QuestionDependency } from "../../models";
import { Room, RoomType, Section, Setting, Template, NotificationLibrary } from "../../models";
import EntityBuilder from "../common/entityBuilder";
import _ from 'lodash';
import SendEmail from "./../../utilities/mail";
import { RenderPDF } from "./exports/pdf-render";
import moment from "moment";
import StorageService from "./../storage/storage";
import { unlink } from 'node:fs/promises';
import { NotificationService } from "../notification/notification";
import { relative } from "node:path";
import { getCheckInOutAnswer, getFunder } from "../../utilities/common";
import {
    QUESTION_KEYS, 
    findByQuestionKey, 
    getAnswerByQuestionKey,
    findByQuestionText,
    findMultipleByQuestionKeys,
    mapQuestionTextToKey,
    getCoordinatorInfo
} from "./question-helper";

const { Op } = require("sequelize");
export class BookingService extends EntityBuilder {
    constructor(entity = 'Booking') {
        super(entity);
    }

    create = async (booking) => {
        const bookingsCount = await this.entityModel.count({ where: { guest_id: booking.guest_id } });

        this[entity] = await this.entityModel.create({ ...booking, type: bookingsCount === 0 ? 'First Time Guest' : 'Returning Guest' });
        return this[entity];
    }

    disseminateChanges = async (booking, qaPairs) => {
        console.log('Disseminating changes for booking:', booking.id);
        let roomData = { booking_id: booking.id };
        let rooms = [];
        const roomExists = await Room.findOne({ where: { booking_id: booking.id } });
        const guest = await Guest.findOne({ where: { id: booking.guest_id } });

        if (roomExists) {
            roomData = { ...roomData, id: roomExists.id };
            rooms.push({ label: roomExists.label, room_type_id: roomExists.room_type_id, order: 1 });
        }

        // Room selection using question key
        const roomQuestion = findByQuestionKey(qaPairs, QUESTION_KEYS.ROOM_SELECTION);
        if (roomQuestion) {
            let selectedRooms = JSON.parse(roomQuestion.answer);
            for (let i = 0; i < selectedRooms.length; i++) {
                const roomType = await RoomType.findOne({ where: { name: selectedRooms[i].name } });
                if (roomType) {
                    rooms.push({ label: roomType.name, room_type_id: roomType.id, order: selectedRooms[i].order });
                }
            }
        }

        // Check-in/out dates using helper method
        const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
        let checkInDateAnswer, checkOutDateAnswer;

        if (checkInOutAnswer?.length === 2) {
            [checkInDateAnswer, checkOutDateAnswer] = checkInOutAnswer;
        }

        if (checkInDateAnswer && checkOutDateAnswer) {
            roomData = { ...roomData, checkin: checkInDateAnswer, checkout: checkOutDateAnswer };

            await Booking.update({ 
                preferred_arrival_date: checkInDateAnswer, 
                preferred_departure_date: checkOutDateAnswer 
            }, { where: { id: booking.id } });

            const bookingEquipments = await BookingEquipment.findAll({ where: { booking_id: booking.id } });
            if (bookingEquipments.length > 0) {
                for (let i = 0; i < bookingEquipments.length; i++) {
                    const currentBookingEquipment = bookingEquipments[i];
                    if (!currentBookingEquipment.start_date && !currentBookingEquipment.end_date) {
                        await currentBookingEquipment.update({ 
                            start_date: checkInDateAnswer, 
                            end_date: checkOutDateAnswer 
                        });
                    }
                }
            }
        }

        // Late arrival using question key
        const lateArrivalQuestion = findByQuestionKey(qaPairs, QUESTION_KEYS.LATE_ARRIVAL);
        if (lateArrivalQuestion) {
            const answerBool = lateArrivalQuestion.answer == true;
            await Booking.update({ late_arrival: answerBool }, { where: { id: booking.id } });
        }

        // Arrival time using question key
        const arrivalTimeAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ARRIVAL_TIME);
        if (arrivalTimeAnswer) {
            roomData = { ...roomData, arrival_time: arrivalTimeAnswer };
        }

        // Guest counts using question keys
        const infantsAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.INFANTS_COUNT);
        const childrenAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.CHILDREN_COUNT);
        const adultsAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ADULTS_COUNT);
        const petsAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ASSISTANCE_ANIMAL);

        if (infantsAnswer) roomData = { ...roomData, infants: infantsAnswer };
        if (childrenAnswer) roomData = { ...roomData, children: childrenAnswer };
        if (adultsAnswer) roomData = { ...roomData, adults: adultsAnswer };
        if (petsAnswer) roomData = { ...roomData, pets: petsAnswer == 'Yes' ? 1 : 0 };

        const totalGuests = parseInt(roomData.infants || 0) + parseInt(roomData.children || 0) + 
                           parseInt(roomData.adults || 0) + parseInt(roomData.pets || 0);
        roomData = { ...roomData, total_guests: totalGuests };
        console.log('Room Data:', roomData);
        console.log('Rooms:', rooms);
        // Update/create rooms
        for (let i = 0; i < rooms.length; i++) {
            const room = await Room.findOne({ where: { booking_id: booking.id, order: rooms[i].order } });
            if (room) {
                room.update({ ...roomData, ...rooms[i] });
            } else {
                const newRoom = { ...roomData, ...rooms[i] };
                delete newRoom.id;
                await Room.create(newRoom);
            }
        }

        if (roomQuestion) {
            await Room.destroy({ where: { booking_id: booking.id, order: { [Op.gt]: rooms.length } } });
        }

        // File uploads using question keys
        const uploadQuestionKeys = [
            QUESTION_KEYS.ICARE_APPROVAL_UPLOAD,
            QUESTION_KEYS.APPROVAL_LETTER_UPLOAD,
            QUESTION_KEYS.CARE_PLAN_UPLOAD,
            QUESTION_KEYS.ASSISTANCE_ANIMAL_CERT_1,
            QUESTION_KEYS.ASSISTANCE_ANIMAL_CERT_2,
            QUESTION_KEYS.ASSISTANCE_ANIMAL_CERT_3
        ];
        
        const uploadsExist = findMultipleByQuestionKeys(qaPairs, uploadQuestionKeys);

        if (uploadsExist.length > 0) {
            const storage = new StorageService({ bucketType: 'restricted' });

            for (let i = 0; i < uploadsExist.length; i++) {
                const upload = uploadsExist[i];
                const copyDestination = storage.bucket.file('guests/' + guest.id + `/documents/${upload.answer}`);
                const [fileExists] = await copyDestination.exists();

                if (!fileExists) {
                    await storage.bucket.file('booking_request_form/' + guest.id + `/${upload.answer}`).copy(copyDestination);
                } else {
                    console.log('file already exists');
                }
            }
        }
    }

    getBookingTemplate = async (booking, raw, includeSections = true) => {
        const bookingOriginalSectionId = booking.Sections[0].orig_section_id;
        const originalSection = await Section.findOne({ where: { id: bookingOriginalSectionId } });
        const page = await Page.findOne({ where: { id: originalSection.model_id } })

        let template;

        let pageInclude = [];
        
        if (includeSections) {
            if (raw) {
                pageInclude = [{
                    model: Section,
                    include: [{
                        model: Question,
                        include: [{
                            model: QuestionDependency,
                            include: ['dependency']
                        }],
                        raw: true
                    }]
                }];
            } else {
                pageInclude = [{
                    model: Section,
                    include: [{
                        model: Question,
                        include: [QuestionDependency]
                    }]
                }];
            }
        }

        template = await Template.findOne({
            where: { id: page.template_id },
            include: [{
                model: Page,
                include: pageInclude
            }],
            order: [[Page, 'order', 'ASC']]
        });

        return template;
    }

    isBookingComplete = async (uuid) => {
        const booking = await this.entityModel.findOne({ where: { uuid }, include: [{ model: Section, include: [{ model: QaPair }] }] });
        const defaultTemplate = await this.getBookingTemplate(booking, false);
        const qaPairs = booking.Sections.map(section => section.QaPairs).flat();
        const templateQuestions = defaultTemplate.Pages.map(page => page.Sections.map(section => section.Questions).flat()).flat();
        
        // REFACTORED: Use question key for funding check
        const isNdisFunder = qaPairs.some(qa => {
            return qa.Question?.question_key === QUESTION_KEYS.FUNDING_SOURCE && 
                   qa.answer && 
                   (qa.answer.includes('NDIS') || qa.answer.includes('NDIA'));
        });
        
        // calculating required questions
        const requiredTemplateQuestions = templateQuestions.filter(question => question.type != 'equipment') // removing equipment questions
            .filter(question => question.required).filter(question => {
                if (question.second_booking_only || question.ndis_only) return false;
                
                // REFACTORED: Use question key for package check
                if (isNdisFunder && question.type == 'radio' && 
                    question.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) return false;
                
                if (question.QuestionDependencies.length == 0) {
                    return true;
                }

                if (question.QuestionDependencies.length > 0) {
                    return question.QuestionDependencies.some(dependency => {
                        const dependencyQuestion = qaPairs.find(q => q.question_id == dependency.dependence_id);
                        if (dependencyQuestion && dependencyQuestion.answer) {
                            if (dependencyQuestion.answer == dependency.answer) {
                                return true;
                            }
                        }
                    })
                }

                return false;
        });

        // validating required questions
        const validatedQuestions = requiredTemplateQuestions.filter(requiredQuestion => {
            const qaPair = qaPairs.find(qa => qa.question_id == requiredQuestion.id);
            if (qaPair) {
                if (qaPair.answer) {
                    return true;
                } else {
                    console.log('this required questions is not answered: ', requiredQuestion)
                }
            } else {
                console.log('this required question is missing: ', requiredQuestion.question)
            }
        })

        console.log('qaPairs:', qaPairs.length)
        console.log('requiredTemplateQuestions:', requiredTemplateQuestions.length)
        console.log('validatedQuestions:', validatedQuestions.length)

        // verifing if all required and validated questions are answered
        if (validatedQuestions.length == requiredTemplateQuestions.length) {
            console.log('Booking is Complete')
            return true;
        }

        return false;
    }

    getCheckInOutAnswerByKeys = (qaPairs) => {
        // Try combined date question first
        const combinedAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.CHECK_IN_OUT_DATE);
        if (combinedAnswer) {
            const answerArr = combinedAnswer.split(' - ');
            if (answerArr?.length > 1) {
                return answerArr;
            }
        }
        
        // Fallback to separate questions
        const checkInAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.CHECK_IN_DATE);
        const checkOutAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.CHECK_OUT_DATE);
        
        if (checkInAnswer && checkOutAnswer) {
            return [checkInAnswer, checkOutAnswer];
        }
        
        return null;
    }

    sendFunderEmail = async (booking, emailTrigger, bookingData) => {
        const qaPairs = bookingData.Sections.map(section => section.QaPairs).flat();
        const guest = bookingData.Guest;

        if (emailTrigger.trigger_questions?.length > 0) {
            const triggerQuestionText = emailTrigger.trigger_questions[0].question;
            const triggerQuestionKey = mapQuestionTextToKey(triggerQuestionText);
            
            let relavantQaPair;
            if (triggerQuestionKey) {
                relavantQaPair = findByQuestionKey(qaPairs, triggerQuestionKey);
            } else {
                relavantQaPair = qaPairs.find(qa => qa.question === triggerQuestionText && qa.answer);
            }
            
            if (relavantQaPair && relavantQaPair.answer) {
                const emailData = {};

                // Get coordinator info using question key
                const coordinatorInfo = getCoordinatorInfo(qaPairs, triggerQuestionKey);
                if (coordinatorInfo.email) {
                    emailData['coordinator_name'] = coordinatorInfo.name;
                    emailData['icare_or_ndis_number'] = coordinatorInfo.participantNumber;
                }

                emailData['guest_name'] = guest.first_name + ' ' + guest.last_name;

                // Check-in/out dates using helper
                const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
                if (checkInOutAnswer?.length === 2) {
                    emailData['check_in_date'] = checkInOutAnswer[0];
                    emailData['check_out_date'] = checkInOutAnswer[1];
                }

                emailData['rooms'] = [];
                bookingData.Rooms.forEach(room => {
                    emailData['rooms'].push({
                        room_type: room.RoomType.name,
                        room_package_price: room.RoomType.price_per_night
                    });
                });
                
                // Package type using question keys
                let packageAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES);
                if (!packageAnswer) {
                    packageAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL);
                }
                if (packageAnswer) {
                    emailData['package_type'] = packageAnswer;
                }

                // Goals using question key
                const reasonForStayAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.GOALS_ACHIEVE);
                if (reasonForStayAnswer) {
                    emailData['reason_for_stay'] = reasonForStayAnswer;
                }

                const funder = getFunder(bookingData.Sections);
                emailData['funder'] = funder;

                if (emailData['funder'] && relavantQaPair?.answer) {
                    await SendEmail(relavantQaPair?.answer, 'Sargood On Collaroy - Booking', emailTrigger.email_template, emailData);
                }
            }
        }
    }

    sendInternalEmail = async (booking, emailTrigger, bookingData) => {
        console.log('sending internal email...');
        const qaPairs = bookingData.Sections.map(section => section.QaPairs).flat();
        const guest = bookingData.Guest;

        const emailData = {};
        
        const triggerQuestionText = emailTrigger.trigger_questions[0].question;
        const triggerQuestionKey = mapQuestionTextToKey(triggerQuestionText);
        
        let relavantQaPair;
        if (triggerQuestionKey) {
            relavantQaPair = findByQuestionKey(qaPairs, triggerQuestionKey);
        } else {
            relavantQaPair = qaPairs.find(qa => qa.question === triggerQuestionText);
        }
       
        if (relavantQaPair) {
            emailData['guest_name'] = guest.first_name + ' ' + guest.last_name;
            emailData['guest_email'] = guest.email;
            emailData['guest_phone'] = guest.phone_number;
            emailData['alternate_contact_name'] = booking.alternate_contact_name;
            emailData['alternate_contact_number'] = booking.alternate_contact_number;

            // Check-in/out dates using helper
            const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
            if (checkInOutAnswer?.length === 2) {
                emailData['check_in_date'] = moment(checkInOutAnswer[0]).format('DD/MM/YYYY');
                emailData['check_out_date'] = moment(checkInOutAnswer[1]).format('DD/MM/YYYY');
            }

            if (relavantQaPair?.answer?.toLowerCase() === 'yes' || relavantQaPair?.answer?.toLowerCase() === 'no') {
                emailData['selected_yes_no_answer'] = relavantQaPair.answer;

                // Clinical nurse services - look for question containing this text
                if (triggerQuestionText.includes('accessing Clinical Nurse Education')) {
                    const clinicalNurseQuestion = findByQuestionText(qaPairs, 'Clinical Nurse Consultation Services');
                    if (clinicalNurseQuestion) {
                        emailData['selected_clinical_nurse_consultation_services'] = 
                            clinicalNurseQuestion.answer ? JSON.parse(clinicalNurseQuestion.answer) : '';
                    }
                }
            } else {
                emailData['selected_list_answer'] = (() => {
                    try {
                      return typeof relavantQaPair.answer === 'object' 
                        ? relavantQaPair.answer 
                        : JSON.parse(relavantQaPair.answer || '""');
                    } catch (error) {
                      return relavantQaPair.answer || "";
                    }
                })();
            }

            emailData['question'] = relavantQaPair.question;
            const funder = getFunder(bookingData.Sections);
            emailData['funder'] = funder;

            if (emailTrigger.recipient && relavantQaPair.answer.toLowerCase() == emailTrigger.trigger_questions[0].answer.toLowerCase()) {
                await SendEmail(emailTrigger.recipient, 'Sargood On Collaroy - New Booking', emailTrigger.email_template, emailData);
            }
        } else {
            console.log(emailTrigger.trigger_questions[0].question, " not found - sending email skipped");
        }
    }

    sendBookingHighlightsEmail = async (booking, emailTrigger, bookingData) => {
        const qaPairs = bookingData.Sections.map(section => section.QaPairs).flat();
        const guest = bookingData.Guest;

        const emailData = {};
        emailData['guest_name'] = guest.first_name + ' ' + guest.last_name;
        emailData['guest_email'] = guest.email;
        emailData['guest_phone'] = guest.phone_number;
        emailData['alternate_contact_name'] = booking.alternate_contact_name;
        emailData['alternate_contact_number'] = booking.alternate_contact_number;

        // Check-in/out dates using helper
        const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
        if (checkInOutAnswer?.length === 2) {
            emailData['check_in_date'] = moment(checkInOutAnswer[0]).format('DD/MM/YYYY');
            emailData['check_out_date'] = moment(checkInOutAnswer[1]).format('DD/MM/YYYY');
        }

        let booking_highlights = [];

        // Process trigger questions - convert to question keys where possible
        for (let i = 0; i < qaPairs.length; i++) {
            for (let j = 0; j < emailTrigger.trigger_questions.length; j++) {
                const triggerQuestion = emailTrigger.trigger_questions[j];
                const triggerQuestionKey = mapQuestionTextToKey(triggerQuestion.question);
                
                // Match by question key if available, otherwise by question text
                let questionMatches = false;
                if (triggerQuestionKey) {
                    // FIXED: Use correct nested structure
                    questionMatches = qaPairs[i].Question?.question_key === triggerQuestionKey;
                } else {
                    questionMatches = qaPairs[i].question === triggerQuestion.question;
                }
                
                if (questionMatches && qaPairs[i].answer) {
                    if (!triggerQuestion.answer) {
                        booking_highlights.push({ 
                            question: qaPairs[i].question, 
                            answer: qaPairs[i].answer 
                        });
                        break;
                    } else if (triggerQuestion.answer === qaPairs[i].answer) {
                        booking_highlights.push({ 
                            question: qaPairs[i].question, 
                            answer: qaPairs[i].answer 
                        });
                        break;
                    }
                }
            }
        }

        emailData['booking_highlights'] = booking_highlights;
        const funder = getFunder(bookingData.Sections);
        emailData['funder'] = funder;

        if (emailTrigger.recipient) {
            await SendEmail(emailTrigger.recipient, 'Sargood On Collaroy - Booking Highlights', emailTrigger.email_template, emailData);
        }
    }

    sendExternalEmail = async (booking, emailTrigger, bookingData) => {
        const qaPairs = bookingData.Sections.map(section => section.QaPairs).flat();
        const guest = bookingData.Guest;
        const emailData = {};

        const triggerQuestionText = emailTrigger.trigger_questions[0].question;
        const triggerQuestionKey = mapQuestionTextToKey(triggerQuestionText);
        
        let relavantQaPair;
        if (triggerQuestionKey) {
            relavantQaPair = findByQuestionKey(qaPairs, triggerQuestionKey);
        } else {
            relavantQaPair = qaPairs.find(qa => qa.question === triggerQuestionText);
        }

        emailData['guest_name'] = guest.first_name + ' ' + guest.last_name;
        emailData['guest_email'] = guest.email;
        emailData['guest_phone'] = guest.phone_number;
        emailData['alternate_contact_name'] = booking.alternate_contact_name;
        emailData['alternate_contact_number'] = booking.alternate_contact_number;

        // Check-in/out dates using helper
        const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
        if (checkInOutAnswer?.length === 2) {
            emailData['check_in_date'] = moment(checkInOutAnswer[0]).format('DD/MM/YYYY');
            emailData['check_out_date'] = moment(checkInOutAnswer[1]).format('DD/MM/YYYY');
        }

        const funder = getFunder(bookingData.Sections);
        emailData['funder'] = funder;

        if (relavantQaPair?.answer && relavantQaPair.answer !== '') {
            await SendEmail(relavantQaPair.answer, 'Sargood On Collaroy - Booking', emailTrigger.email_template, emailData);
        } else {
            console.log('invalid recipient for external email: ', emailTrigger);
        }
    }

    sendBookingAmendedEmail = async (booking, emailTrigger, bookingData) => {
        const guest = bookingData.Guest;
        const qaPairs = bookingData.Sections.map(section => section.QaPairs).flat();

        const emailData = {};
        emailData['guest_name'] = guest.first_name + ' ' + guest.last_name;
        emailData['guest_email'] = guest.email;
        emailData['guest_phone'] = guest.phone_number;
        emailData['alternate_contact_name'] = booking.alternate_contact_name;
        emailData['alternate_contact_number'] = booking.alternate_contact_number;

        // Check-in/out dates using helper
        const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
        if (checkInOutAnswer?.length === 2) {
            emailData['check_in_date'] = moment(checkInOutAnswer[0]).format('DD/MM/YYYY');
            emailData['check_out_date'] = moment(checkInOutAnswer[1]).format('DD/MM/YYYY');
        }

        const funder = getFunder(bookingData.Sections);
        emailData['funder'] = funder;

        const bookingStatus = JSON.parse(booking.status);
        if (bookingStatus.name == 'booking_amended') {
            await SendEmail(emailTrigger.recipient, 'Sargood On Collaroy - Booking', emailTrigger.email_template, emailData);
        }
    }


    sendInternalHealthInfo = async (booking, emailTrigger, bookingData) => {
        const qaPairs = bookingData.Sections.map(section => section.QaPairs).flat();
        const guest = bookingData.Guest;

        if (emailTrigger.trigger_questions?.length > 0) {
            let emailData = {};

            emailData['guest_name'] = guest.first_name + ' ' + guest.last_name;
            emailData['guest_email'] = guest.email;
            emailData['guest_phone'] = guest.phone_number;
            emailData['alternate_contact_name'] = booking.alternate_contact_name;
            emailData['alternate_contact_number'] = booking.alternate_contact_number;

            const funder = getFunder(bookingData.Sections);
            emailData['funder'] = funder;

            // Check-in/out dates using helper
            const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
            if (checkInOutAnswer?.length === 2) {
                emailData['check_in_date'] = moment(checkInOutAnswer[0]).format('DD/MM/YYYY');
                emailData['check_out_date'] = moment(checkInOutAnswer[1]).format('DD/MM/YYYY');
            }

            const affirmedQuestions = [];
            const emailQuestions = emailTrigger.trigger_questions;
            
            emailQuestions.forEach(emailQuestion => {
                const triggerQuestionKey = mapQuestionTextToKey(emailQuestion.question);
                let relavantQaPair;
                
                if (triggerQuestionKey) {
                    relavantQaPair = findByQuestionKey(qaPairs, triggerQuestionKey);
                } else {
                    relavantQaPair = qaPairs.find(qa => qa.question === emailQuestion.question && qa.answer);
                }
                
                if (relavantQaPair && relavantQaPair.answer) {
                    if (emailQuestion.hasOwnProperty('question') && typeof emailQuestion.answer != 'object') {
                        const triggerQuestion = emailQuestion;
                        if (triggerQuestion && triggerQuestion.answer != relavantQaPair.answer) {
                            return;
                        }
                        affirmedQuestions.push(triggerQuestion.question);
                    }

                    if (emailData['healthInfo'] == undefined || emailData['healthInfo'].length == 0) {
                        let answer = relavantQaPair.answer;
                        let filteredAnswer = null;
                        if (relavantQaPair.question_type == 'checkbox') {
                            answer = JSON.parse(answer);
                            filteredAnswer = answer.filter(a => {
                                let ans = a.toLowerCase();
                                if (ans.includes('pressure injuries') || ans.includes('open wounds') || 
                                    ans.includes('admission to hospital') || ans.includes('recent surgery') || 
                                    ans.includes('mental health') || ans.includes('anaphalaxis') ||
                                    ans.includes('diabetes') || ans.includes('epilepsy') || 
                                    ans.includes('subcutaneous injections')) {
                                    return a;
                                }
                            });
                        }
                        emailData['healthInfo'] = filteredAnswer ?? answer;
                    }
                }
            });

            if (affirmedQuestions.length > 0) {
                emailData['affirmed_questions'] = affirmedQuestions;
            }

            if (emailData['healthInfo'] && emailData['healthInfo'].length > 0) {
                console.log('=========================================================================');
                console.log('email sent to ', emailTrigger.recipient);
                console.log('=========================================================================');
                await SendEmail(emailTrigger.recipient, 'Sargood On Collaroy - Booking', emailTrigger.email_template, emailData);
            }
        }
    }

    sendInternalFoundationStay = async (booking, emailTrigger, bookingData, cancel = false) => {
        const qaPairs = bookingData.Sections.map(section => section.QaPairs).flat();
        const guest = bookingData.Guest;

        const emailData = {};
        
        const triggerQuestionText = emailTrigger.trigger_questions[0].question;
        const triggerQuestionKey = mapQuestionTextToKey(triggerQuestionText);
        
        let relavantQaPair;
        if (triggerQuestionKey) {
            relavantQaPair = findByQuestionKey(qaPairs, triggerQuestionKey);
        } else {
            relavantQaPair = qaPairs.find(qa => qa.question === triggerQuestionText);
        }
       
        if (relavantQaPair && relavantQaPair.dataValues.answer.toLowerCase() == emailTrigger.trigger_questions[0].answer.toLowerCase()) {
            // Set message based on funding question
            const fundingAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.FUNDING_SOURCE);
            const travelGrantAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.TRAVEL_GRANT_APPLICATION);
            
            if (fundingAnswer) {
                emailData['message'] = 'The guest is applying for financial assistance through the Sargood Foundation.';
            } else if (travelGrantAnswer) {
                emailData['message'] = 'The guest is applying for a travel grant.';
            }

            emailData['guest_name'] = guest.first_name + ' ' + guest.last_name;
            emailData['guest_email'] = guest.email;
            emailData['guest_phone'] = guest.phone_number;

            // Date of birth using question key
            const dobAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.DATE_OF_BIRTH);
            emailData['dob'] = dobAnswer;

            // Check-in/out dates and calculate nights
            const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
            if (checkInOutAnswer?.length === 2) {
                emailData['nights_stay'] = moment(checkInOutAnswer[1]).diff(moment(checkInOutAnswer[0]), 'days');
                emailData['arrivalDate'] = moment(checkInOutAnswer[0]).format('DD/MM/YYYY');
                emailData['departureDate'] = moment(checkInOutAnswer[1]).format('DD/MM/YYYY');
            }

            // Package information using question keys
            let packageAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL);
            if (!packageAnswer) {
                packageAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES);
            }
            
            if (packageAnswer) {
                let packageCost;
                if (packageAnswer.includes('Wellness & Support Package')) {
                    packageCost = 985;
                } else if (packageAnswer.includes('Wellness & High Support Package')) {
                    packageCost = 1365;
                } else if (packageAnswer.includes('Wellness & Very High Support Package')) {
                    packageCost = 1740;
                }
                
                if (packageCost) {
                    emailData['package'] = `${packageAnswer} - $${packageCost}/night`;
                } else {
                    emailData['package'] = packageAnswer;
                }
            }

            // Financial assistance reason using question key
            const applyingAssistanceAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.FINANCIAL_ASSISTANCE_REASON);
            emailData['applying_assistance'] = applyingAssistanceAnswer;

            // Goals using question key
            const goals1Answer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.GOALS_ACHIEVE);
            emailData['goals1'] = goals1Answer;

            // Travel grant reason using question key
            const whyGrantAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.TRAVEL_GRANT_REASON);
            emailData['why_grant'] = whyGrantAnswer;

            // FIXED: Handle multiple goals questions using correct nested structure
            const goals2QaPairs = qaPairs.filter(qa => qa.Question?.question_key === QUESTION_KEYS.GOALS_ACHIEVE);
            let goals2Answer = '';
            if (goals2QaPairs && goals2QaPairs.length > 1) {
                goals2Answer = goals2QaPairs[1]?.answer;
            }
            emailData['goals2'] = goals2Answer;

            // Funding amount using question key
            const howMuchAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.FUNDING_AMOUNT_TRAVEL);
            emailData['how_much'] = howMuchAnswer;

            const funder = getFunder(bookingData.Sections);
            emailData['funder'] = funder;

            if (emailTrigger.recipient) {
                await SendEmail(emailTrigger.recipient, 'Sargood On Collaroy - New Booking', emailTrigger.email_template, emailData);
            }
        } else {
            console.log(emailTrigger.trigger_questions[0].question, " not found - sending email skipped");
        }
    }

    // THIS FUNCTION IS DEPRECATED
    triggerEmails = async (booking) => {
        if (this.isBookingComplete(booking.uuid)) {
            // trigger email
            const emailTriggers = await EmailTrigger.findAll({ where: { enabled: true, recipient: { [Op.not]: null } } });

            const bookingData = await this.entityModel.findOne({ where: { uuid: booking.uuid }, include: [{ model: Section, include: [{ model: QaPair }] }, { model: Room, include: [{ model: RoomType }] }, Guest] });

            for (let i = 0; i < emailTriggers.length; i++) {
                switch (emailTriggers[i].email_template) {
                    case 'funder-external-booking':
                        await this.sendFunderEmail(booking, emailTriggers[i], bookingData);
                        break;
                    case 'internal-recipient-new-booking':
                        await this.sendInternalEmail(booking, emailTriggers[i], bookingData);
                        break;
                    case 'external-recipient-new-booking':
                        await this.sendExternalEmail(booking, emailTriggers[i], bookingData);
                    case 'recipient-booking-amended':
                        await this.sendBookingAmendedEmail(booking, emailTriggers[i], bookingData);
                    case "internal-recipient-health-info":
                        await this.sendInternalHealthInfo(booking, emailTriggers[i], bookingData);
                        break;
                    case "booking-highlights":
                        await this.sendBookingHighlightsEmail(booking, emailTriggers[i], bookingData);
                        break;
                    default:
                        break;
                }
            }

            return true;
        } else return false;
    }

    triggerEmailsOnSubmit = async (booking) => {
        if (this.isBookingComplete(booking.uuid)) {
            // trigger email
            console.log('triggering emails on booking submit...')
            const emailTriggers = await EmailTrigger.findAll({ where: { enabled: true } });

            const bookingData = await this.entityModel.findOne({ where: { uuid: booking.uuid }, include: [{ model: Section, include: [{ model: QaPair }] }, { model: Room, include: [{ model: RoomType }] }, Guest] });

            for (let i = 0; i < emailTriggers.length; i++) {
                switch (emailTriggers[i].email_template) {
                    case 'funder-external-booking':
                        await this.sendFunderEmail(booking, emailTriggers[i], bookingData);
                        break;
                    case 'external-recipient-new-booking':
                        if (emailTriggers[i].trigger_questions.includes('Which course?')) {
                            await this.sendExternalEmail(booking, emailTriggers[i], bookingData);
                        }
                        break;
                    case 'recipient-booking-amended':
                        await this.sendBookingAmendedEmail(booking, emailTriggers[i], bookingData);
                        break;
                    case "internal-recipient-health-info":
                        await this.sendInternalHealthInfo(booking, emailTriggers[i], bookingData);
                        break;
                    case "booking-highlights":
                        await this.sendBookingHighlightsEmail(booking, emailTriggers[i], bookingData);
                        break;
                    case "internal-recipient-foundation-stay":
                        await this.sendInternalFoundationStay(booking, emailTriggers[i], bookingData);
                        break;
                    default:
                        break;
                }
            }

            return true;
        } else return false;
    }

    triggerEmailsOnBookingConfirmed = async (booking) => {
        if (this.isBookingComplete(booking.uuid)) {
            // trigger email
            const emailTriggers = await EmailTrigger.findAll({ where: { enabled: true } });

            const bookingData = await this.entityModel.findOne({ where: { uuid: booking.uuid }, include: [{ model: Section, include: [{ model: QaPair }] }, { model: Room, include: [{ model: RoomType }] }, Guest] });

            for (let i = 0; i < emailTriggers.length; i++) {
                switch (emailTriggers[i].email_template) {
                    case 'internal-recipient-new-booking':
                        // if (!emailTriggers[i].trigger_questions.includes('Which course?')) {
                            await this.sendInternalEmail(booking, emailTriggers[i], bookingData);
                        // }
                        break;
                    default:
                        break;
                }
            }

            return true;
        } else return false;
    }

    triggerEmailPerQuestion = async (booking, question, answer) => {
        const emailTrigger = await EmailTrigger.find({
            where: {
              enabled: true,
              recipient: {
                [Op.not]: null
              },
              [Op.and]: [
                Sequelize.literal(`EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(trigger_questions) AS item
                  WHERE (item->>'question' = :questionValue)
                  AND (
                    CASE 
                      WHEN jsonb_typeof(item->'answer') = 'array' 
                      THEN :answerValue = ANY(SELECT jsonb_array_elements_text(item->'answer'))
                      ELSE item->>'answer' = :answerValue
                    END
                  )
                )`),
              ]
            },
            replacements: {
              questionValue: question,
              answerValue: answer
            }
        });

        if (emailTrigger) {
            switch (emailTrigger.email_template) {
                // case 'funder-external-booking':
                //     await this.sendFunderEmail(booking, emailTrigger, booking);
                //     break;
                // case 'internal-recipient-new-booking':
                //     await this.sendInternalEmail(booking, emailTrigger, booking);
                //     break;
                // case 'external-recipient-new-booking':
                //     await this.sendExternalEmail(booking, emailTrigger, booking);
                // case 'recipient-booking-amended':
                //     await this.sendBookingAmendedEmail(booking, emailTrigger, booking);
                // case "internal-recipient-health-info":
                //     await this.sendInternalHealthInfo(booking, emailTrigger, booking);
                //     break;
                // case "booking-highlights":
                //     await this.sendBookingHighlightsEmail(booking, emailTrigger, booking);
                //     break;
                default:
                    break;
            }
    
            return true;
        }
        
        return false;
    }

    generatePDFExport = async (booking) => {
        const storage = new StorageService({ bucketType: 'restricted' });

        console.log('validating booking completion for pdf generation......');
        const isBookingComplete = await this.isBookingComplete(booking.uuid);
        if (isBookingComplete) {
            const pdfData = {
                app_url: process.env.APP_URL,
            };

            const bookingData = await Booking.findOne({
                where: { uuid: booking.uuid },
                include: [
                    { model: Section, include: [{ model: QaPair, include: [Question] }] },
                    { model: Room, include: [RoomType] },
                    { model: Guest, attributes: { exclude: ['password', 'email_verified'] } },
                    { model: Equipment, include: [EquipmentCategory] },
                ],
                plain: true
            });

            pdfData.guest_name = bookingData.Guest.first_name + ' ' + bookingData.Guest.last_name;
            pdfData.guest_email = bookingData.Guest.email;
            pdfData.guest_phone = bookingData.Guest.phone_number;
            pdfData.alternate_contact_name = booking.alternate_contact_name;
            pdfData.alternate_contact_phone = booking.alternate_contact_number;

            pdfData.checkin_date = bookingData.Rooms[0]?.checkin ? moment(bookingData.Rooms[0].checkin).format("MM/DD") : null;
            pdfData.checkout_date = bookingData.Rooms[0]?.checkout ? moment(bookingData.Rooms[0].checkout).format("MM/DD") : null;
            pdfData.arrival_time = bookingData.Rooms[0]?.arrival_time;
            pdfData.total_guests = bookingData.Rooms[0]?.total_guests;
            pdfData.adults = bookingData.Rooms[0]?.adults;
            pdfData.children = bookingData.Rooms[0]?.children;
            pdfData.infants = bookingData.Rooms[0]?.infants;
            pdfData.pets = bookingData.Rooms[0]?.pets;
            pdfData.room_label = bookingData.Rooms[0]?.label;
            pdfData.king_single_beds = bookingData.Rooms[0]?.RoomType.king_single_beds;
            pdfData.ergonomic_king_beds = bookingData.Rooms[0]?.RoomType.ergonomic_king_beds;
            pdfData.queen_sofa_beds = bookingData.Rooms[0]?.RoomType.queen_sofa_beds;
            pdfData.bedrooms = bookingData.Rooms[0]?.RoomType.bedrooms;
            pdfData.bathrooms = bookingData.Rooms[0]?.RoomType.bathrooms;
            pdfData.ocean_view = bookingData.Rooms[0]?.RoomType.ocean_view > 0 ? true : false;

            const equipments = bookingData.Equipment?.map(equipment => {
                const eq = `${equipment.name} - ${equipment.serial_number ? equipment.serial_number : 'N/A'}`;
                return eq;
            });

            pdfData.sections = [];
            bookingData.Sections.forEach(section => {
                pdfData.sections.push({
                    label: section.label,
                    questions: section.QaPairs.map(qaPair => {
                        if (qaPair.answer) {
                            if (qaPair.question_type == 'equipment') {
                                return {
                                    label: qaPair.label,
                                    question: qaPair.question,
                                    answer: equipments.join(', ')
                                }
                            }
                            return {
                                label: qaPair.label,
                                question: qaPair.question,
                                answer: this.parseAndConcatenate(qaPair.answer, qaPair.question_type)
                            }
                        }
                    }).filter(qa => qa)
                });

                section.QaPairs.forEach(qaPair => {
                    // FIXED: Package detection using question keys with correct nested structure
                    if (qaPair.Question?.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES ||
                        qaPair.Question?.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) {
                        if (qaPair.answer) {
                            pdfData.package = this.parseAndConcatenate(qaPair.answer, qaPair.question_type);
                        }
                    }

                    // FIXED: Course detection using question key with correct nested structure
                    if (qaPair.Question?.question_key === QUESTION_KEYS.COURSE_SELECTION) {
                        pdfData.course = this.parseAndConcatenate(qaPair.answer, qaPair.question_type);
                    }

                    // FIXED: Health info using question key with correct nested structure
                    if (qaPair.Question?.question_key === QUESTION_KEYS.HEALTH_CONDITIONS) {
                        pdfData.healthinfo_updated_date = moment(qaPair.updatedAt).format('DD/MM/YYYY');

                        const healthInfoSelectedOptions = JSON.parse(qaPair.answer);
                        let healthInfo = [];

                        qaPair.Question.options.forEach(option => {
                            healthInfo.push({
                                diagnose: option.label,
                                answer: healthInfoSelectedOptions ? healthInfoSelectedOptions.includes(option.label) : false
                            });
                        });

                        pdfData.healthinfo = healthInfo;
                    }
                });
            });

            // Generate package/course code
            if (!pdfData.course) {
                pdfData.package_course_code = this.serializePackage(pdfData.package);
            } else if (pdfData.course) {
                pdfData.package_course_code = 'Course' + this.serializePackage(pdfData.package);
            } else {
                pdfData.package_course_code = 'N/A';
            }

            console.log('calling render function');
            await RenderPDF({
                htmlTemplatePath: process.env.APP_ROOT + '/templates/exports/booking.html',
                pdfData: pdfData,
                pdfPath: process.env.APP_ROOT + '/templates/exports/temp/' + booking.uuid + '.pdf',
            });

            console.log('uploading export file');
            await storage.uploadFile(process.env.APP_ROOT + '/templates/exports/temp/' + booking.uuid + '.pdf', 'exports/' + booking.uuid + '.pdf');

            setTimeout(async () => {
                await unlink(process.env.APP_ROOT + '/templates/exports/temp/' + booking.uuid + '.pdf');
                console.log('removing local export file');
            }, 5000);

            return true;
        } else return false;
    }

    serializePackage = (packageType) => {
        if (packageType.includes("Wellness & Very High Support Package")) {
          return "WVHS";
        } else if (packageType.includes("Wellness & High Support Package")) {
          return "WHS";
        } else if (packageType.includes("Wellness & Support") || packageType.includes("Wellness and Support")) {
          return "WS";
        } else if (packageType.includes("NDIS Support Package - No 1:1 assistance with self-care")) {
          return "SP"
        } else if (packageType.includes("NDIS Care Support Package - includes up to 6 hours of 1:1 assistance with self-care")) {
          return "CSP"
        } else if (packageType.includes("NDIS High Care Support Package - includes up to 12 hours of 1:1 assistance with self-care")) {
          return "HCSP"
        } else {
          return '';
        }
    } 

    parseAndConcatenate = (data, questionType = '') => {
        function parseStringData(data) {
          if (typeof data !== 'string') {
            return data;
          }
      
          try {
            return JSON.parse(data);
          } catch (error) {
            return data;
          }
        }
      
        const parsedData = parseStringData(data);
      
        function flattenArray(arr) {
          return arr.reduce((acc, val) => 
            Array.isArray(val) ? acc.concat(flattenArray(val)) : acc.concat(val), []);
        }
      
        function processObjectValues(obj) {
          if (questionType === 'room' && obj.name) {
            return [obj.name];
          }
          return Object.values(obj).map(value => 
            typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)
          );
        }
      
        let result;
        if (Array.isArray(parsedData)) {
          result = flattenArray(parsedData.map(item => 
            typeof item === 'object' && item !== null ? processObjectValues(item) : item
          ));
        } else if (typeof parsedData === 'object' && parsedData !== null) {
          result = processObjectValues(parsedData);
        } else {
          result = [String(parsedData)];
        }
      
        return result.join(', ');
    }

    generateNotifications = async (booking) => {

        if (this.isBookingComplete(booking.uuid)) {

            const guest = await Guest.findOne({ where: { id: booking.guest_id } });
            const room = await Room.findOne({ where: { booking_id: booking.id } });

            const guestName = guest.first_name + ' ' + guest.last_name;
            const arrivalDate = moment(room.checkin).format('DD/MM/YYYY');
            const notificationLink = process.env.APP_URL + '/bookings/' + booking.uuid;

            const notificationLibs = await NotificationLibrary.findAll({ where: { enabled: true } });

            const notificationService = new NotificationService();

            for (let index = 0; index < notificationLibs.length; index++) {
                const lib = notificationLibs[index];
                let message = lib.notification;

                message = message.replace('[guest_name]', guestName);
                message = message.replace('[arrival_date]', arrivalDate);

                const dispatch_date = moment().add(lib.date_factor, 'days').toDate();
                await notificationService.notificationHandler({
                    notification_to: lib.notification_to,
                    message: message,
                    link: notificationLink,
                    dispatch_date: dispatch_date
                });
            }
            const metainfo = JSON.parse(booking.metainfo);
            await Booking.update({ metainfo: JSON.stringify({ ...metainfo, "notifications": true }) }, { where: { id: booking.id } });
        }
    }

    generateBookingStatusChangeNotifications = async (booking, status) => {
        const notificationLibs = await NotificationLibrary.findAll({ where: { enabled: true, name: "Booking Status Change" } });
        const notificationService = new NotificationService();

        const notificationLink = process.env.APP_URL + '/bookings/' + booking.uuid;

        for (let index = 0; index < notificationLibs.length; index++) {
            const lib = notificationLibs[index];
            let message = lib.notification;

            if (lib.alert_type == 'admin') {
                message = message.replace('[guest_name]', `${booking.Guest?.first_name} ${booking.Guest?.last_name}`);
            }

            message = message.replace('[booking_id]', booking.reference_id);

            if (status == 'ready_to_process') {
                message = message.replace('[has been] [status]', 'has been received and is awaiting processing');
            } else if (status == 'pending approval') {
                message = message.replace('[has been]', 'has been marked');
                message = message.replace('[status]', status);
            } else {
                message = message.replace('[has been]', 'has been');
                message = message.replace('[status]', status);
            }

            const dispatch_date = moment().add(lib.date_factor, 'days').toDate();
            await notificationService.notificationHandler({
                notification_to: lib.alert_type == 'admin' ? lib.notification_to : booking.Guest?.email,
                message: message,
                link: lib.alert_type == 'admin' ? notificationLink : null,
                dispatch_date: dispatch_date
            });
        }
    }

    sendBookingEmail = async (type, booking) => {
        const bookingData = await this.entityModel.findOne({ where: { uuid: booking.uuid }, include: [{ model: Section, include: [{ model: QaPair }] }, { model: Room, include: [{ model: RoomType }] }, Guest] });
        const guest = bookingData.Guest;

        const sendBookingAmendedEmail = async () => {
            const emailData = {};

            emailData['guest_name'] = guest.first_name + ' ' + guest.last_name;

            const bookingStatus = JSON.parse(booking.status);
            if (bookingStatus.name == 'booking_amended') {
                await SendEmail(guest.email, 'Sargood On Collaroy - Booking', "booking-amended", emailData);
                await SendEmail("info@sargoodoncollaroy.com.au", 'Sargood On Collaroy - Booking', "booking-amended-admin", emailData);
            }
        }

        switch (type) {
            case 'amendment':
                sendBookingAmendedEmail();
                break;
            default:
                break;
        }
    }

    validateBookingHasCourse = async (booking) => {
        const bookingData = await this.entityModel.findOne({
            where: { uuid: booking.uuid }, 
            include: [{ model: Section, include: [{ model: QaPair }] }]
        });
        const qaPairs = bookingData.Sections.map(section => section.QaPairs).flat();

        const courseAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.COURSE_SELECTION);
        return !!(courseAnswer);
    }

    manageBookingEquipment = async (booking, equipmentChanges = []) => {
        if (!booking || equipmentChanges.length == 0) {
            return;
        }

        const promise = await new Promise(async (resolve) => {
                const response = await Promise.all(equipmentChanges.map(async (equipmentChange) => {
                    const { category, equipments, isDirty } = equipmentChange;

                    if (category != 'acknowledgement') {
                        const existingEquipments = booking.Equipment
                            .filter(equipment => equipment?.dataValues?.EquipmentCategory?.name === category)
                            .map(equipment => equipment.dataValues);

                        equipments.map(async (equipment) => {
                            if (equipment.type == 'independent') {
                                const currentEquipment = existingEquipments.find((existingEquipment) => 
                                    existingEquipment && existingEquipment.category_id == equipment.category_id 
                                    && existingEquipment.hidden == equipment.hidden
                                );
                                if (currentEquipment && currentEquipment.type == 'independent') {
                                    // update the existing equipment
                                    if (equipment.value) {
                                        if (isDirty && booking.complete && (currentEquipment.id != equipment.id)) {
                                            await Log.create({
                                                loggable_id: booking.id,
                                                loggable_type: 'booking',
                                                type: 'equipment',
                                                data: {
                                                    id: equipment.id,
                                                    oldAnswerId: currentEquipment.id,
                                                    approved: false,
                                                    approved_by: null,
                                                    approval_date: null,
                                                    qa_pair: {
                                                        question: 'Equipment Changed',
                                                        answer: equipment.name,
                                                        question_type: 'equipment',
                                                        oldAnswer: currentEquipment.name,
                                                    }
                                                }
                                            });
                                        }

                                        await BookingEquipment.update({
                                            equipment_id
                                                : equipment.id
                                        }, { where: { booking_id: booking.id, equipment_id: currentEquipment.id } });
                                    } else {
                                        if (isDirty && booking.complete) {
                                            await Log.create({
                                                loggable_id: booking.id,
                                                loggable_type: 'booking',
                                                type: 'equipment',
                                                data: {
                                                    oldAnswerId: currentEquipment.id,
                                                    approved: false,
                                                    approved_by: null,
                                                    approval_date: null,
                                                    qa_pair: {
                                                        question: 'Equipment Removed',
                                                        answer: '',
                                                        question_type: 'equipment',
                                                        oldAnswer: currentEquipment.name,
                                                    }
                                                }
                                            });
                                        }
                                        // remove the equipment
                                        await BookingEquipment.destroy({ where: { booking_id: booking.id, equipment_id: currentEquipment.id } });
                                    }
                                }

                                if (!currentEquipment && equipment.type == 'independent' && equipment.value) {
                                    // add the new equipment
                                    const result = await BookingEquipment.create({ booking_id: booking.id, equipment_id: equipment.id });
                                    if (isDirty && booking.complete) {
                                        await Log.create({
                                            loggable_id: booking.id,
                                            loggable_type: 'booking',
                                            type: 'equipment',
                                            data: {
                                                id: result?.id,
                                                approved: false,
                                                approved_by: null,
                                                approval_date: null,
                                                qa_pair: {
                                                    question: 'Equipment Added',
                                                    answer: equipment.name,
                                                    question_type: 'equipment',
                                                    oldAnswer: '',
                                                }
                                            }
                                        });
                                    }
                                }
                            } else if (equipment.type == 'group') {
                                const equipmentExists = existingEquipments.find((existingEquipment) => existingEquipment && existingEquipment.id == equipment.id);
                                if (equipmentExists && equipment.value == false) {
                                    if (isDirty && booking.complete) {
                                        await Log.create({
                                            loggable_id: booking.id,
                                            loggable_type: 'booking',
                                            type: 'equipment',
                                            data: {
                                                oldAnswerId: equipmentExists.id,
                                                approved: false,
                                                approved_by: null,
                                                approval_date: null,
                                                qa_pair: {
                                                    question: 'Equipment Removed',
                                                    answer: '',
                                                    question_type: 'equipment',
                                                    oldAnswer: equipmentExists.name,
                                                }
                                            }
                                        });
                                    }
                                    // remove the equipment
                                    await BookingEquipment.destroy({ where: { booking_id: booking.id, equipment_id: equipmentExists.id } });
                                } else if (!equipmentExists && equipment.value == true) {
                                    // add the equipment
                                    const result = await BookingEquipment.create({ booking_id: booking.id, equipment_id: equipment.id });

                                    if (isDirty && booking.complete) {
                                        await Log.create({
                                            loggable_id: booking.id,
                                            loggable_type: 'booking',
                                            type: 'equipment',
                                            data: {
                                                id: result?.id,
                                                approved: false,
                                                approved_by: null,
                                                approval_date: null,
                                                qa_pair: {
                                                    question: 'Equipment Added',
                                                    answer: equipment.name,
                                                    question_type: 'equipment',
                                                    oldAnswer: '',
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        });
                    } else {
                        const equipment = equipments[0];
                        const existingEquipments = booking.Equipment
                            .filter(equipment => equipment.dataValues.type === category)
                            .map(equipment => equipment.dataValues);

                        const equipmentExists = existingEquipments.find((existingEquipment) => existingEquipment && existingEquipment.id == equipment.id);
                        if (equipmentExists && equipment.value == false) {
                            // if (isDirty && booking.complete) {
                            //     await Log.create({
                            //         loggable_id: booking.id,
                            //         loggable_type: 'booking',
                            //         type: 'equipment',
                            //         data: {
                            //             oldAnswerId: equipmentExists.id,
                            //             approved: false,
                            //             approved_by: null,
                            //             approval_date: null,
                            //             qa_pair: {
                            //                 question: 'Equipment Removed',
                            //                 answer: '',
                            //                 question_type: 'equipment',
                            //                 oldAnswer: equipmentExists.name,
                            //             }
                            //         }
                            //     });
                            // }
                            // remove the equipment
                            await BookingEquipment.destroy({ where: { booking_id: booking.id, equipment_id: equipmentExists.id } });
                        } else if (!equipmentExists && equipment.value == true) {
                            // add the equipment
                            const result = await BookingEquipment.create({ booking_id: booking.id, equipment_id: equipment.id });

                            // if (isDirty && booking.complete) {
                            //     await Log.create({
                            //         loggable_id: booking.id,
                            //         loggable_type: 'booking',
                            //         type: 'equipment',
                            //         data: {
                            //             id: result?.id,
                            //             approved: false,
                            //             approved_by: null,
                            //             approval_date: null,
                            //             qa_pair: {
                            //                 question: 'Equipment Added',
                            //                 answer: equipment.name,
                            //                 question_type: 'equipment',
                            //                 oldAnswer: '',
                            //             }
                            //         }
                            //     });
                            // }
                        }
                    }
                }));

                await sleep(500);

                resolve(response);
        }).catch(err => {
            console.error(err)
            throw err;
        })

        if (promise) {
            return true;
        }
    }

    sendEmailDateOfStay = async (booking) => {
        console.log('triggering sendEmailDateOfStay on booking');

        const bookingData = await this.entityModel.findOne({ 
            where: { uuid: booking.uuid }, 
            include: [{ model: Section, include: [{ model: QaPair }] }, Guest] 
        });
        
        const qaPairs = bookingData.Sections.map(section => section.QaPairs).flat();
        const guest = bookingData.Guest;

        const emailData = {};
        emailData['guest_name'] = guest.first_name + ' ' + guest.last_name;
        
        // Use helper method for dates
        const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
        if (checkInOutAnswer?.length === 2) {
            const checkin = moment(checkInOutAnswer[0]).format('DD/MM/YYYY');
            const checkout = moment(checkInOutAnswer[1]).format('DD/MM/YYYY');
            emailData['dateOfStay'] = `${checkin} - ${checkout}`;
        }

        if (emailData['dateOfStay']) {
            await SendEmail(guest?.email, 'Sargood On Collaroy - Booking', "booking-notify-date-of-stay", emailData);
            return true;
        } else {
            return false;
        }
    }
}


const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));