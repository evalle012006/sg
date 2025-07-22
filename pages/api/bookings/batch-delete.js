// /pages/api/bookings/batch-delete.js

import { Op } from "sequelize";
import { Booking } from "../../../models";

export default async function handler(req, res) {
    // Only allow POST method for batch operations
    if (req.method !== 'POST') {
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    // Extract booking UUIDs from request body
    const { uuids } = req.body;

    // Validate input
    if (!uuids || !Array.isArray(uuids) || uuids.length === 0) {
        return res.status(400).json({ 
            message: 'Invalid request. Please provide an array of booking UUIDs.',
            status: 'error'
        });
    }

    try {
        // Get current timestamp for all deletions
        const deletedAt = new Date();
        
        // Instead of finding and updating each booking individually,
        // use a bulk update for better performance
        const result = await Booking.update(
            { deleted_at: deletedAt },
            { 
                where: { 
                    uuid: { [Op.in]: uuids },
                    deleted_at: null // Only target non-deleted bookings
                }
            }
        );
        
        // result[0] contains the number of rows affected
        const deletedCount = result[0];
        
        if (deletedCount === 0) {
            return res.status(404).json({ 
                message: 'No matching bookings found to delete',
                requested: uuids.length,
                deleted: 0,
                status: 'warning'
            });
        }
        
        // Return success with deletion count
        return res.status(200).json({
            message: `Successfully deleted ${deletedCount} booking${deletedCount !== 1 ? 's' : ''}`,
            requested: uuids.length,
            deleted: deletedCount,
            status: 'success'
        });
        
    } catch (error) {
        console.error('Error in batch delete operation:', error);
        return res.status(500).json({ 
            message: 'An error occurred during the batch delete operation',
            error: error.message,
            status: 'error'
        });
    }
}