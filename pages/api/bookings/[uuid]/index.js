import {
    Address, Booking, Equipment, EquipmentCategory, Guest,
    Log, Page, QaPair, Question, Room, RoomType, Section
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

            const fileExists = await storage.fileExists('exports/' + booking.uuid + '.pdf');
            if (fileExists) {
                pdfFileUrl = await storage.getSignedUrl('exports/' + booking.uuid + '.pdf');
            }
            res.json({ ...booking.toJSON(), pdfFileUrl });
        }
        return res.status(404).end();
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