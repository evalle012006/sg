import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { Equipment, EquipmentCategory, Supplier } from "../../../models/";
import StorageService from "../../../services/storage/storage";

export default async function handler(req, res) {
    // -- Authentication guard ------------------------------------------------
    // All callers must be authenticated. The booking form guest flow is
    // authenticated via NextAuth session cookies (type: 'guest').
    // Unauthenticated requests are rejected with 401 consistent with the
    // rest of the platform.
    const session = await getServerSession(req, res, authOptions);

    if (!session) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // -- includeHidden logic -------------------------------------------------
    // Any authenticated caller may request hidden items via includeHidden=true.
    // The original security concern was unauthenticated access — that is now
    // blocked by the 401 guard above.
    //
    // Guests legitimately need hidden items during the booking form flow
    // (specifically the hidden acknowledgement-type equipment used by returning
    // guests). Restricting includeHidden to admins only breaks that flow.
    //
    // If a stricter policy is needed in future (e.g. guests only see
    // acknowledgement items, not all hidden items), add a separate endpoint
    // for acknowledgement equipment rather than filtering here.
    const { includeHidden } = req.query;

    const whereClause = includeHidden === 'true'
        ? {}
        : { hidden: false };

    const storage = new StorageService({ bucketType: 'restricted' });

    const equipments = await Equipment.findAll({
        where: whereClause,
        include: [EquipmentCategory, Supplier],
        order: [['created_at', 'DESC']],
        raw: true,
        nest: true
    });

    for (let i = 0; i < equipments.length; i++) {
        if (equipments[i].image_filename && !equipments[i].image_filename.includes("default-")) {
            const url = await storage.getSignedUrl('equipment-photo' + '/' + equipments[i].image_filename);
            equipments[i].image_url = url;
        }
    }

    return res.status(200).json(equipments);
}