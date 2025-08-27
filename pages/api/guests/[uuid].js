import { Booking, Guest, QaPair, Room, RoomType, Section, Comment, User, HealthInfo, GuestFunding } from "./../../../models"
import { omitAttribute } from "../../../utilities/common";
import StorageService from "../../../services/storage/storage";
import { Op } from "sequelize";
import { 
    QUESTION_KEYS, 
    getAnswerByQuestionKey,
    findByQuestionKeyWithFallback
} from "../../../services/booking/question-helper";

export default async function handler(req, res) {
    const dateRangeRegEx = /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\s-\s20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    const { uuid } = req.query;

    const storage = new StorageService({ bucketType: 'restricted' });

    const guest = await Guest.findOne({
        where: { uuid },
        include: [
            {
                model: Comment,
                plain: true,
                include: [User]
            },
            {
                model: GuestFunding,
                as: 'funding',
                required: false
            }
        ]
    });
    
    if (!guest) {
        return res.status(404).json({ message: 'Guest not found' });
    }

    if (req.method === 'DELETE') {
        await Guest.destroy({ where: { uuid } });
        return res.status(200).json({ message: 'User deleted successfully' });
    }

    let error = false;
    let errorMessage = null;

    if (req.method === 'POST') {
        if (guest.email !== req.body.email) {
            const existingGuest = await Guest.findOne({ where: { email: req.body.email }, include: [Booking] });
            if (existingGuest) {
                error = true;
                errorMessage = 'Email already in used';

                if (existingGuest.Booking && existingGuest.Booking.length > 0) {
                    errorMessage += ', and has existing bookings';
                }
            }
        }

        if (!error) {
            await Guest.update(req.body, { where: { uuid } });

            if (req.body.flags && req.body.flags.includes('banned')) {
                await Guest.update({ active: false }, { where: { uuid } });
            }
        }
    }

    const guestBookings = await Booking.findAll({
        where: {
            deleted_at: null, 
            guest_id: guest.id, 
            [Op.not]: [{
                [Op.and]: [
                    { status: { [Op.like]: '%guest_cancelled%' }, complete: { [Op.not]: true } }
                ]
            }]
        },
        include: [{
            model: Room,
            include: [RoomType],
            plain: true
        }, {
            model: Section,
            plain: true,
            include: [QaPair]
        }],
    });

    let bookings = [];
    
    for (let i = 0; i < guestBookings.length; i++) {
        let currentBooking = { ...guestBookings[i] };

        let check_in_date = null;
        let check_out_date = null;
        let ndisNumber = null;
        let icareNumber = null;

        // Collect all QA pairs from all sections for this booking
        let allQaPairs = [];
        for (let j = 0; j < currentBooking.Sections.length; j++) {
            allQaPairs = [...allQaPairs, ...currentBooking.Sections[j].QaPairs];
        }

        // Extract dates using question keys with fallback to old question text
        const checkInOutDateQA = findByQuestionKeyWithFallback(
            allQaPairs, 
            QUESTION_KEYS.CHECK_IN_OUT_DATE, 
            'Check In Date and Check Out Date'
        );
        
        if (checkInOutDateQA && dateRangeRegEx.test(checkInOutDateQA.answer)) {
            const dates = checkInOutDateQA.answer.split(' - ');
            check_in_date = dates[0];
            check_out_date = dates[1];
        }

        // If combined date not found, look for individual dates
        if (!check_in_date) {
            check_in_date = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_DATE) ||
                           allQaPairs.find(qa => qa.question === 'Check In Date')?.answer;
        }
        
        if (!check_out_date) {
            check_out_date = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_OUT_DATE) ||
                            allQaPairs.find(qa => qa.question === 'Check Out Date')?.answer;
        }

        // Extract NDIS and iCare numbers using question keys
        ndisNumber = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) ||
                     allQaPairs.find(qa => qa.question === 'NDIS Participant Number')?.answer;

        icareNumber = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.ICARE_PARTICIPANT_NUMBER) ||
                      allQaPairs.find(qa => qa.question === 'icare Participant Number')?.answer;

        // Process rooms with images - handle multiple rooms per booking
        let roomsWithImages = [];
        if (currentBooking.Rooms && currentBooking.Rooms.length > 0) {
            for (let roomIndex = 0; roomIndex < currentBooking.Rooms.length; roomIndex++) {
                const room = currentBooking.Rooms[roomIndex];
                let roomWithImage = { ...room.dataValues };

                // Add room type image if available
                if (room.RoomType && room.RoomType.image_filename) {
                    try {
                        const imageUrl = await storage.getSignedUrl('room-type-photo/' + room.RoomType.image_filename);
                        roomWithImage.RoomType = {
                            ...room.RoomType.dataValues,
                            imageUrl: imageUrl
                        };
                    } catch (error) {
                        console.warn(`Failed to generate signed URL for room image: ${room.RoomType.image_filename}`, error);
                        roomWithImage.RoomType = {
                            ...room.RoomType.dataValues,
                            imageUrl: null
                        };
                    }
                } else if (room.RoomType) {
                    roomWithImage.RoomType = {
                        ...room.RoomType.dataValues,
                        imageUrl: null
                    };
                }

                roomsWithImages.push(roomWithImage);
            }
        }

        bookings.push({ 
            ...currentBooking.dataValues, 
            Rooms: roomsWithImages, // Updated rooms with images
            check_in_date, 
            check_out_date, 
            ndisNumber, 
            icareNumber 
        });
    }

    // Handle guest profile image
    let profileUrl;
    if (guest.profile_filename) {
        profileUrl = await storage.getSignedUrl('profile-photo' + '/' + guest.profile_filename);
    }

    const healthInfo = await HealthInfo.findOne({ where: { guest_id: guest.id } });

    const responseData = { 
        ...omitAttribute(guest.dataValues, "password", "createdAt"), 
        Bookings: bookings, 
        profileUrl, 
        HealthInfo: healthInfo, 
        error, 
        errorMessage 
    };
    
    return res.status(200).json(responseData);
}