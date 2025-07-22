import StorageService from "../../../../services/storage/storage";
import { Address, Permission, Role, User } from "./../../../../models";
import { omitAttribute } from "./../../../../utilities/common";

export default async function handler(req, res) {
    const { email } = req.query;
    const storage = new StorageService({ bucketType: 'restricted' });

    try {
        if (req.method === 'DELETE') {
            await User.destroy({ where: { email } });
            return res.status(200).json({ message: 'User deleted successfully' });
        }

        if (req.method === 'POST') {
            await User.update(req.body, { where: { email } });
        }

        const user = await User.findOne({ 
            where: { email }, 
            include: [Address, { model: Role, include: [Permission] }] 
        });

        // Check if user exists
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get profile URL if profile_filename exists
        let profileUrl = null;
        if (user.profile_filename) {
            profileUrl = await storage.getSignedUrl('profile-photo/' + user.profile_filename);
        }

        // Return user data
        return res.status(200).json({ 
            ...omitAttribute(user.dataValues, "password", "createdAt", "updatedAt"), 
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