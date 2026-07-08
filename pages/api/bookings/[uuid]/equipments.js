// pages/api/bookings/[uuid]/equipments.js

import { getToken } from 'next-auth/jwt';
import { Booking, Equipment, EquipmentCategory } from "../../../../models";

export default async function handler(req, res) {
    const { uuid } = req.query;

    // -- Authentication guard ------------------------------------------------
    // Use getToken() instead of getServerSession() because the platform uses
    // a custom CredentialsProvider with no session callbacks defined.
    // getServerSession() only forwards name/email/image to session.user by
    // default -- custom fields like id and type are on the JWT token but never
    // reach session.user without an explicit session callback.
    // getToken() reads the raw JWT directly, giving us all fields that
    // authorize() returned, including id and type.
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || process.env.SECRET });

    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // -- Load booking --------------------------------------------------------
    const booking = await Booking.findOne({
        where: { uuid },
        include: [{ model: Equipment, include: EquipmentCategory }]
    });

    if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // -- Authorisation -------------------------------------------------------
    // token.type and token.id are undefined for sessions minted before the
    // NextAuth jwt callback fix was deployed. The email domain fallback bridges
    // the gap until all admin sessions have been re-issued via logout/login.
    // Remove the second condition once confirmed all admins have re-logged in.
    const isAdmin = token.type === 'user' ||
                    (token.type === undefined && token.email?.endsWith('@sargoodoncollaroy.com.au'));
    const isOwner = Number(booking.guest_id) === Number(token.id);

    if (!isAdmin && !isOwner) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.status(200).json(booking.Equipment ?? []);
}