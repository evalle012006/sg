import { Booking, Guest, QaPair, Room, RoomType, Section, Comment, User, HealthInfo } from "./../../../models"
import { omitAttribute } from "../../../utilities/common";
import StorageService from "../../../services/storage/storage";
import { Op } from "sequelize";

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
            deleted_at: null, guest_id: guest.id, [Op.not]: [{
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

        for (let j = 0; j < currentBooking.Sections.length; j++) {
            let currentSection = { ...currentBooking.Sections[j] };

            for (let k = 0; k < currentSection.QaPairs.length; k++) {
                if (currentSection.QaPairs[k].question === 'Check In Date and Check Out Date' && dateRangeRegEx.test(currentSection.QaPairs[k].answer)) {
                    const dates = currentSection.QaPairs[k].answer.split(' - ');
                    check_in_date = dates[0];
                    check_out_date = dates[1];
                }

                if (currentSection.QaPairs[k].question === 'Check In Date') {
                    check_in_date = currentSection.QaPairs[k].answer;
                }
                if (currentSection.QaPairs[k].question === 'Check Out Date') {
                    check_out_date = currentSection.QaPairs[k].answer;
                }

                if (currentSection.QaPairs[k].question === 'NDIS Participant Number') {
                    ndisNumber = currentSection.QaPairs[k].answer;
                }

                if (currentSection.QaPairs[k].question === 'icare Participant Number') {
                    icareNumber = currentSection.QaPairs[k].answer;
                }
            }
        }

        bookings.push({ ...currentBooking.dataValues, check_in_date, check_out_date, ndisNumber, icareNumber });
    }

    let profileUrl;
    if (guest.profile_filename) {
        profileUrl = await storage.getSignedUrl('profile-photo' + '/' +  guest.profile_filename);
    }

    const healthInfo = await HealthInfo.findOne({ where: { guest_id: guest.id } });

    const responseData = { ...omitAttribute(guest.dataValues, "password", "createdAt"), Bookings: bookings, profileUrl, HealthInfo: healthInfo, error, errorMessage };
    return res.status(200).json(responseData);
}