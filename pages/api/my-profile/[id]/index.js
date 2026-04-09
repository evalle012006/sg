import { Guest, FundingApproval, HealthInfo } from '../../../../models'; 
import StorageService from '../../../../services/storage/storage';
import { omitAttribute } from '../../../../utilities/common';
const { getFundingProfilesForGuest } = require('../../../../services/booking/guest-funding-profile-service');

export default async function handler(req, res) {
    try {
        const { id } = req.query;
        console.log('Fetching profile for ID:', id);
        
        if (!id) {
            return res.status(400).json({ message: 'ID is required' });
        }

        const guest = await Guest.findOne({ 
            where: { id }, 
            include: [
                {
                    model: HealthInfo,
                    required: false
                },
                {
                    model: FundingApproval,
                    as: 'fundingApprovals',
                    required: false
                }
            ]
        });
        
        if (!guest) {
            return res.status(404).json({ message: 'Guest information not found' });
        }

        const storage = new StorageService({ bucketType: 'restricted' });
        
        let profileUrl = null;
        if (guest.profile_filename) {
            try {
                profileUrl = await storage.getSignedUrl('profile-photo' + '/' + guest.profile_filename);
            } catch (error) {
                console.error('Error generating signed URL for profile image:', error);
                profileUrl = null;
            }
        }

        let fundingProfiles = { icare: null, ndis: null };
        try {
            fundingProfiles = await getFundingProfilesForGuest(guest.id);
        } catch (fpError) {
            console.error('Error fetching funding profiles:', fpError);
        }

        const responseData = {
            ...omitAttribute(guest.dataValues, "password", "createdAt", "updatedAt"), 
            profileUrl,
            fundingProfiles,
        };

        return res.status(200).json(responseData);
    } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}