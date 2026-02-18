import { BookingService } from "../../../../services/booking/booking";
import {
    Address, Booking, BookingApprovalUsage, Equipment, EquipmentCategory, 
    FundingApproval, Guest, Log, Page, QaPair, Question, Room, RoomType, 
    Section, Template
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
                {
                    model: BookingApprovalUsage,
                    as: 'approvalUsages',
                    include: [{
                        model: FundingApproval,
                        as: 'approval',
                        attributes: ['id', 'approval_number', 'approval_name', 'nights_approved', 'nights_used']
                    }],
                    attributes: ['id', 'booking_id', 'funding_approval_id', 'room_type', 'nights_consumed', 'status']
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
            let templateId = null;
            if (booking.Sections && booking.Sections.length > 0) {
                try {
                    const bookingService = new BookingService();
                    const template = await bookingService.getBookingTemplate(booking, false);
                    if (template) {
                        templateId = template.id;
                    }

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

                bookingData.Sections = await Promise.all(bookingData.Sections.map(async (section) => {
                    if (section.QaPairs && section.QaPairs.length > 0) {
                        section.QaPairs = await Promise.all(section.QaPairs.map(async (qaPair) => {
                            // Check if this is a file-upload question
                            const questionType = qaPair.Question?.question_type || qaPair.Question?.type;
                            
                            if (questionType === 'file-upload' && qaPair.answer) {
                                try {
                                    let filenames = [];
                                    
                                    // Parse answer if it's a JSON string
                                    if (typeof qaPair.answer === 'string') {
                                        try {
                                            const parsed = JSON.parse(qaPair.answer);
                                            filenames = Array.isArray(parsed) ? parsed : [parsed];
                                        } catch (e) {
                                            // If not JSON, treat as single filename
                                            filenames = [qaPair.answer];
                                        }
                                    } else if (Array.isArray(qaPair.answer)) {
                                        filenames = qaPair.answer;
                                    } else {
                                        filenames = [qaPair.answer];
                                    }
                                    
                                    // Generate signed URLs for each file
                                    const guestId = booking.guest_id;
                                    const fileUrls = await Promise.all(
                                        filenames.map(async (filename) => {
                                            if (!filename) return null;
                                            
                                            try {
                                                const filePath = `booking_request_form/${guestId}/${filename}`;
                                                
                                                const fileExists = await storage.fileExists(filePath);
                                                if (fileExists) {
                                                    const signedUrl = await storage.getSignedUrl(filePath);
                                                    return {
                                                        filename: filename,
                                                        url: signedUrl,
                                                        signedUrl: signedUrl
                                                    };
                                                }
                                            } catch (error) {
                                                console.error(`Error generating signed URL for ${filename}:`, error);
                                            }
                                            
                                            return {
                                                filename: filename,
                                                url: null,
                                                signedUrl: null,
                                                error: 'File not found'
                                            };
                                        })
                                    );
                                    
                                    // Add file URLs to the QaPair
                                    return {
                                        ...qaPair,
                                        fileUrls: fileUrls.filter(Boolean)
                                    };
                                } catch (error) {
                                    console.error('Error processing file-upload answer:', error);
                                }
                            }
                            
                            return qaPair;
                        }));
                    }
                    
                    return section;
                }));
            }

            // Determine cancellation type from approval usages
            let cancellationType = 'No Charge';
            if (bookingData.approvalUsages && bookingData.approvalUsages.length > 0) {
                const usageStatuses = bookingData.approvalUsages.map(u => u.status);
                
                if (usageStatuses.includes('charged')) {
                    cancellationType = 'Full Charge';
                } else if (usageStatuses.includes('cancelled')) {
                    cancellationType = 'No Charge';
                }
            }

            const response = {
                ...bookingData,
                pdfFileUrl,
                templatePages: templatePages || [],
                guestProfileFileUrl: booking.Guest?.profileFileUrl || null,
                Rooms: roomsWithImages,
                cancellationType,
                templateId
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