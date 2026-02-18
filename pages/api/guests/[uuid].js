import { 
    Booking, 
    Guest, 
    QaPair, 
    Room, 
    RoomType, 
    Section, 
    Comment, 
    User, 
    HealthInfo, 
    FundingApproval,
    Package
} from "./../../../models"
import { omitAttribute } from "../../../utilities/common";
import StorageService from "../../../services/storage/storage";
import { Op } from "sequelize";
import { 
    QUESTION_KEYS, 
    getAnswerByQuestionKey,
    findByQuestionKeyWithFallback
} from "../../../services/booking/question-helper";
import { BookingService } from "../../../services/booking/booking";

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
                model: FundingApproval,
                as: 'fundingApprovals', 
                required: false,
                include: [
                    {
                        model: Package,
                        as: 'package',
                        attributes: ['id', 'name', 'package_code']
                    }
                ]
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

    const bookingService = new BookingService();
    let bookings = [];
    
    for (let i = 0; i < guestBookings.length; i++) {
        let currentBooking = { ...guestBookings[i] };
        const template = await bookingService.getBookingTemplate(currentBooking, false);
        let templateId = null;
        if (template) {
            templateId = template.id;
        }

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
            ['When would you like to stay?']
        );

        if (checkInOutDateQA && checkInOutDateQA.answer) {
            const answer = checkInOutDateQA.answer;
            if (dateRangeRegEx.test(answer)) {
                const dates = answer.split(' - ');
                check_in_date = dates[0];
                check_out_date = dates[1];
            }
        }

        // Extract NDIS number
        const ndisQA = findByQuestionKeyWithFallback(
            allQaPairs,
            QUESTION_KEYS.NDIS_NUMBER,
            ['NDIS number', 'What is your NDIS number?']
        );
        if (ndisQA) {
            ndisNumber = ndisQA.answer;
        }

        // Extract iCare number
        const icareQA = findByQuestionKeyWithFallback(
            allQaPairs,
            QUESTION_KEYS.ICARE_NUMBER,
            ['icare number', 'What is your icare number?']
        );
        if (icareQA) {
            icareNumber = icareQA.answer;
        }

        // Process room images
        let roomsWithImages = [];
        if (currentBooking.Rooms && currentBooking.Rooms.length > 0) {
            for (const room of currentBooking.Rooms) {
                let roomWithImage = { ...room.dataValues };
                
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
            Rooms: roomsWithImages,
            check_in_date, 
            check_out_date, 
            ndisNumber, 
            icareNumber,
            templateId
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