import { BookingService } from "../../../../services/booking/booking";
import {
    Address, Booking, Equipment, EquipmentCategory, Guest,
    Log, Page, QaPair, Question, Room, RoomType, Section, Template
} from "./../../../../models";
import StorageService from "./../../../../services/storage/storage";

export default async function handler(req, res) {

    if (req.method === 'GET') {
        const { uuid } = req.query;

        const storage = new StorageService({ bucketType: 'restricted' });

        const booking = await Booking.findOne({
            where: { uuid: uuid, deleted_at: null },
            include: [
                {
                    model: Section,
                    include: [
                        { model: QaPair, include: [{ model: Question, include: [{ model: Section, include: [Page] }] }] }
                    ]
                },
                {
                    model: Room,
                    include: [RoomType]
                },
                {
                    model: Guest,
                    attributes: { exclude: ['password', 'email_verified'] },
                    include: Address
                },
                {
                    model: Equipment,
                    include: [EquipmentCategory]
                },
                Log
            ],
        });

        if (booking) {
            let pdfFileUrl = null;
            let templatePages = null;

            const fileExists = await storage.fileExists('exports/' + booking.uuid + '.pdf');
            if (fileExists) {
                pdfFileUrl = await storage.getSignedUrl('exports/' + booking.uuid + '.pdf');
            }

            if (booking.Sections && booking.Sections.length > 0) {
                try {
                    const bookingService = new BookingService();
                    const template = await bookingService.getBookingTemplate(booking, false);

                    if (template && template.Pages) {
                        templatePages = template.Pages
                            .map(page => ({
                                id: page.id,
                                title: page.title,
                                order: page.order
                            }))
                            .sort((a, b) => a.order - b.order);
                    }
                } catch (error) {
                    console.error('Error fetching template pages:', error);
                }
            }

            if (booking.Guest && booking.Guest.profile_filename) {
                const fileExists = await storage.fileExists('guest-photo/' + booking.Guest.profile_filename);
                if (fileExists) {
                    booking.Guest.profileFileUrl = await storage.getSignedUrl('guest-photo/' + booking.Guest.profile_filename);
                }
            }

            let roomsWithImages = [];
            if (booking.Rooms && booking.Rooms.length > 0) {
                roomsWithImages = await Promise.all(booking.Rooms.map(async (room) => {
                    let updatedRoom = room.toJSON();
                    const imageExists = await storage.fileExists('room-type-photo/' + room?.RoomType?.image_filename);
                    if (imageExists) {
                        updatedRoom.imageUrl = await storage.getSignedUrl('room-type-photo/' + room?.RoomType?.image_filename);
                    }
                    return updatedRoom;
                }));
            }

            const bookingData = booking.toJSON();

            // Add pageId to sections in the JSON data
            if (booking.Sections.length > 0) {
                const origSectionIds = booking.Sections
                    .map(section => section.orig_section_id)
                    .filter(id => id);

                if (origSectionIds.length > 0) {
                    const templateSections = await Section.findAll({
                        where: {
                            id: origSectionIds,
                            model_type: 'page'
                        },
                        include: [{
                            model: Page,
                            attributes: ['id']
                        }]
                    });

                    const sectionToPageMap = {};
                    templateSections.forEach(templateSection => {
                        if (templateSection.Page) {
                            sectionToPageMap[templateSection.id] = templateSection.Page.id;
                        }
                    });

                    // Add pageId to the JSON sections
                    bookingData.Sections = bookingData.Sections.map(section => ({
                        ...section,
                        pageId: sectionToPageMap[section.orig_section_id] || null
                    }));
                }
            }

            const response = {
                ...bookingData,
                pdfFileUrl,
                templatePages: templatePages || [],
                guestProfileFileUrl: booking.Guest?.profileFileUrl || null,
                Rooms: roomsWithImages
            };

            return res.status(200).json(response);
        }
        
        return res.status(404).json({ message: 'Booking not found' });
    }

    if (req.method === 'DELETE') {
        const { uuid } = req.query;
        const booking = await Booking.findOne({ where: { uuid } });
        console.log('booking', booking)

        if (booking) {
            await booking.update({ deleted_at: new Date() });
        }
        else {
            return res.status(404).json({ message: 'Booking not found' });
        }

        return res.status(200).json({ message: 'Booking deleted' });
    }

    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
}