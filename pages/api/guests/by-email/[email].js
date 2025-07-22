import StorageService from "../../../../services/storage/storage";
import { Address, Guest } from "./../../../../models";
import { omitAttribute } from "./../../../../utilities/common";

export default async function handler(req, res) {
    const { email } = req.query;
    const storage = new StorageService({ bucketType: 'restricted' });

    try {
        // Handle DELETE request
        if (req.method === 'DELETE') {
            await Guest.destroy({ where: { email } });
            return res.status(200).json({ message: 'User deleted successfully' });
        }

        // Handle POST request
        if (req.method === 'POST') {
            await Guest.update(req.body, { where: { email } });
            // Note: Not returning here, continuing to fetch updated guest data
        }

        // Find guest data for both GET requests and after POST updates
        const guest = await Guest.findOne({ 
            where: { email }, 
            include: [Address] 
        });

        // Return 404 if guest not found
        if (!guest) {
            return res.status(404).json({ message: "Guest not found" });
        }

        // Process profile picture if it exists
        let profileUrl = null;
        if (guest.profile_filename) {
            profileUrl = await storage.getSignedUrl('profile-photo/' + guest.profile_filename);
        }

        // Return guest data
        return res.status(200).json({ 
            ...omitAttribute(guest.dataValues, "password", "createdAt", "updatedAt"), 
            profile_url: profileUrl 
        });
    } catch (error) {
        console.error("API error:", error);
        return res.status(500).json({ 
            message: "Server error", 
            error: error.message 
        });
    }
}