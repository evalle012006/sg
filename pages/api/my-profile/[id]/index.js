import { Guest, HealthInfo } from '../../../../models';
import StorageService from '../../../../services/storage/storage';

export default async function handler(req, res) {
    try {
        const { id } = req.query;
        console.log('Fetching profile for ID:', id);
        
        if (!id) {
            return res.status(400).json({ message: 'ID is required' });
        }

        const guest = await Guest.findOne({ 
            where: { id }, 
            include: HealthInfo 
        });
        
        if (!guest) {
            return res.status(404).json({ message: 'Guest information not found' });
        }

        // Initialize storage service to get profile image URL
        const storage = new StorageService({ bucketType: 'restricted' });
        
        let profileUrl = null;
        if (guest.profile_filename) {
            try {
                profileUrl = await storage.getSignedUrl('profile-photo' + '/' + guest.profile_filename);
            } catch (error) {
                console.error('Error generating signed URL for profile image:', error);
                // Don't fail the entire request if image URL generation fails
                profileUrl = null;
            }
        }

        // Return guest data with profile URL
        const responseData = {
            ...guest.dataValues,
            profileUrl
        };

        return res.status(200).json(responseData);
    } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}