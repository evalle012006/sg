import { Booking, BookingEquipment, Checklist, ChecklistAction, Comment, Guest, QaPair, Room, Section, sequelize } from '../../../models';
import sendMail from '../../../utilities/mail';

export default async function handler(req, res) {
    const data = JSON.parse(req.body);

    try {
        const guest = await Guest.findOne({ where: { id: data.id } });
        const booking = await Booking.findOne({ where: { guest_id: data.id }, include: [Guest] });

        if (booking) {
            const sections = await Section.findAll({ where: { model_type: 'booking', model_id: booking?.id } });
            sections.map(async section => {
                await QaPair.destroy({ where: { section_id: section.id } });
            });
            await Section.destroy({ where: { model_type: 'booking', model_id: booking?.id } });
            const checklists = await Checklist.findAll({ where: { booking_id: booking?.id } });
            checklists.map(async checklist => {
                await ChecklistAction.destroy({ where: { checklist_id: checklist.id } });
            });
            await Checklist.destroy({ where: { booking_id: booking?.id } });


            await Room.destroy({ where: { booking_id: booking?.id } });
            await BookingEquipment.destroy({ where: { booking_id: booking?.id } });

            await Booking.destroy({ where: { id: booking?.id } });
        }

        await Guest.destroy({ where: { id: data.id } });
        await Comment.destroy({ where: { guest_id: data.id } });

        if (guest) {
            await sendMail(guest.email, 'Sargood On Collaroy - Account Termination', 'email-account-termination', { guest_name: guest.first_name });
        }

        return res.status(200).end(JSON.stringify({ success: true }));
    } catch (error) {
        if(error.errno == 1451){
            return res.status(500).end(JSON.stringify({ error: true, message: "This guest is associated with a booking and cannot be deleted." }));
        }
        return res.status(500).end(JSON.stringify({ error: true, message: error.message }));
    }
}
