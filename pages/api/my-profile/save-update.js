import { Guest, HealthInfo, sequelize } from '../../../models';

export default async function handler(req, res) {
    if (req.method !== 'POST' && req.method !== 'PUT') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { 
            guest_id,
            // Guest information
            first_name,
            last_name,
            email,
            phone_number,
            gender,
            dob,
            address_street1,
            address_street2,
            address_city,
            address_state_province,
            address_postal,
            address_country,
            profile_filename,
            flags,
            // Health information
            identify_aboriginal_torres,
            language,
            require_interpreter,
            cultural_beliefs,
            emergency_name,
            emergency_mobile_number,
            emergency_email,
            emergency_relationship,
            specialist_name,
            specialist_mobile_number,
            specialist_practice_name,
            sci_year,
            sci_level_asia,
            sci_intial_spinal_rehab,
            sci_type,
            sci_type_level,
            sci_inpatient,
            sci_injury_type,
            sci_other_details
        } = req.body;

        // Validate required guest_id
        if (!guest_id) {
            return res.status(400).json({ message: 'guest_id is required' });
        }

        // UPDATED: Only validate required guest fields IF they are being sent AND are empty
        const requiredGuestFields = {};
        if (first_name !== undefined) requiredGuestFields.first_name = first_name;
        if (last_name !== undefined) requiredGuestFields.last_name = last_name;
        if (email !== undefined) requiredGuestFields.email = email;

        const missingFields = Object.keys(requiredGuestFields).filter(
            field => !requiredGuestFields[field]?.trim()
        );
        
        if (missingFields.length > 0) {
            return res.status(400).json({ 
                message: `Please fill in required fields: ${missingFields.join(', ')}` 
            });
        }

        // Helper function to properly handle sci_type_level conversion
        const processSciTypeLevel = (value) => {
            if (!value) return null;
            
            // If it's already an array, return it
            if (Array.isArray(value)) {
                return value.length > 0 ? value : null;
            }
            
            // If it's a string, convert to array
            if (typeof value === 'string') {
                const levels = value.split(',').map(level => level.trim()).filter(level => level);
                return levels.length > 0 ? levels : null;
            }
            
            return null;
        };

        // Start transaction for data consistency
        const result = await sequelize.transaction(async (transaction) => {
            // 1. UPDATE GUEST INFORMATION (only if provided)
            const guestUpdateData = {};
            if (first_name !== undefined) guestUpdateData.first_name = first_name;
            if (last_name !== undefined) guestUpdateData.last_name = last_name;
            if (email !== undefined) guestUpdateData.email = email;
            if (phone_number !== undefined) guestUpdateData.phone_number = phone_number;
            if (gender !== undefined) guestUpdateData.gender = gender;
            if (dob !== undefined) guestUpdateData.dob = dob || null;
            if (profile_filename !== undefined) guestUpdateData.profile_filename = profile_filename;
            if (flags !== undefined) guestUpdateData.flags = flags || [];
            if (address_street1 !== undefined) guestUpdateData.address_street1 = address_street1;
            if (address_street2 !== undefined) guestUpdateData.address_street2 = address_street2;
            if (address_city !== undefined) guestUpdateData.address_city = address_city;
            if (address_state_province !== undefined) guestUpdateData.address_state_province = address_state_province;
            if (address_postal !== undefined) guestUpdateData.address_postal = address_postal;
            if (address_country !== undefined) guestUpdateData.address_country = address_country;

            let guestUpdatedRows = 0;
            if (Object.keys(guestUpdateData).length > 0) {
                [guestUpdatedRows] = await Guest.update(guestUpdateData, {
                    where: { id: parseInt(guest_id) },
                    transaction
                });
            }

            // 2. HANDLE HEALTH INFORMATION (only if provided)
            const healthUpdateData = {};
            if (identify_aboriginal_torres !== undefined) {
                healthUpdateData.identify_aboriginal_torres = identify_aboriginal_torres === true ? true : 
                                                            identify_aboriginal_torres === false ? false : null;
            }
            if (language !== undefined) healthUpdateData.language = language || null;
            if (require_interpreter !== undefined) {
                healthUpdateData.require_interpreter = require_interpreter === true ? true : 
                                                     require_interpreter === false ? false : null;
            }
            if (cultural_beliefs !== undefined) healthUpdateData.cultural_beliefs = cultural_beliefs || null;
            if (emergency_name !== undefined) healthUpdateData.emergency_name = emergency_name || null;
            if (emergency_mobile_number !== undefined) healthUpdateData.emergency_mobile_number = emergency_mobile_number || null;
            if (emergency_email !== undefined) healthUpdateData.emergency_email = emergency_email || null;
            if (emergency_relationship !== undefined) healthUpdateData.emergency_relationship = emergency_relationship || null;
            if (specialist_name !== undefined) healthUpdateData.specialist_name = specialist_name || null;
            if (specialist_mobile_number !== undefined) healthUpdateData.specialist_mobile_number = specialist_mobile_number || null;
            if (specialist_practice_name !== undefined) healthUpdateData.specialist_practice_name = specialist_practice_name || null;
            if (sci_year !== undefined) healthUpdateData.sci_year = sci_year || null;
            if (sci_level_asia !== undefined) healthUpdateData.sci_level_asia = sci_level_asia || null;
            if (sci_intial_spinal_rehab !== undefined) healthUpdateData.sci_intial_spinal_rehab = sci_intial_spinal_rehab || null;
            if (sci_type !== undefined) healthUpdateData.sci_type = sci_type || null;
            
            // UPDATED: Properly handle sci_type_level as array
            if (sci_type_level !== undefined) {
                healthUpdateData.sci_type_level = processSciTypeLevel(sci_type_level);
            }
            
            if (sci_inpatient !== undefined) {
                healthUpdateData.sci_inpatient = sci_inpatient === true ? true : 
                                               sci_inpatient === false ? false : null;
            }
            if (sci_injury_type !== undefined) healthUpdateData.sci_injury_type = sci_injury_type || null;
            if (sci_other_details !== undefined) healthUpdateData.sci_other_details = sci_other_details || null;

            // NEW: Clear sci_type when sci_injury_type and sci_type_level have data
            if ((sci_injury_type && sci_injury_type.trim()) || (sci_type_level && processSciTypeLevel(sci_type_level))) {
                healthUpdateData.sci_type = null;
                console.log('Clearing sci_type because sci_injury_type or sci_type_level has data');
            }

            if (sci_type !== null && sci_type !== undefined && sci_type.trim()) {
                healthUpdateData.sci_injury_type = null;
                healthUpdateData.sci_type_level = null;
                console.log('Clearing sci_injury_type and sci_type_level because sci_type is set');
            }

            let healthResult = null;
            if (Object.keys(healthUpdateData).length > 0) {
                // Check if health info already exists
                const existingHealthInfo = await HealthInfo.findOne({ 
                    where: { guest_id: parseInt(guest_id) },
                    transaction
                });

                if (existingHealthInfo) {
                    // Update existing health info
                    await HealthInfo.update(healthUpdateData, {
                        where: { guest_id: parseInt(guest_id) },
                        transaction
                    });
                    
                    healthResult = await HealthInfo.findOne({ 
                        where: { guest_id: parseInt(guest_id) },
                        transaction
                    });
                } else {
                    // Create new health info record
                    healthResult = await HealthInfo.create({
                        guest_id: parseInt(guest_id),
                        ...healthUpdateData
                    }, { transaction });
                }
            }

            // 3. FETCH UPDATED COMPLETE PROFILE
            const updatedGuest = await Guest.findByPk(parseInt(guest_id), {
                include: [{
                    model: HealthInfo,
                    required: false
                }],
                transaction
            });

            if (!updatedGuest) {
                throw new Error('Guest not found');
            }

            return {
                guest: updatedGuest,
                health: healthResult || updatedGuest.HealthInfo,
                guestUpdated: guestUpdatedRows > 0 || Object.keys(healthUpdateData).length > 0
            };
        });

        // Map database fields back to frontend format for response
        const responseData = {
            id: result.guest.id,
            uuid: result.guest.uuid,
            first_name: result.guest.first_name,
            last_name: result.guest.last_name,
            email: result.guest.email,
            phone_number: result.guest.phone_number,
            gender: result.guest.gender,
            dob: result.guest.dob,
            profile_filename: result.guest.profile_filename,
            flags: result.guest.flags || [],
            address_street1: result.guest.address_street1,
            address_street2: result.guest.address_street2,
            address_city: result.guest.address_city,
            address_state_province: result.guest.address_state_province,
            address_postal: result.guest.address_postal,
            address_country: result.guest.address_country,
            // Include health info
            HealthInfo: result.health
        };

        return res.status(200).json({
            message: 'Profile updated successfully',
            data: responseData,
            fieldsUpdated: result.guestUpdated
        });

    } catch (error) {
        console.error('Error saving/updating profile:', error);
        
        // Handle specific Sequelize validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                message: 'Validation error',
                errors: error.errors.map(err => ({
                    field: err.path,
                    message: err.message
                }))
            });
        }

        // Handle foreign key constraint errors
        if (error.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({
                message: 'Invalid guest_id. Guest does not exist.'
            });
        }

        // Handle custom errors
        if (error.message.includes('Guest not found')) {
            return res.status(404).json({ message: error.message });
        }

        return res.status(500).json({ 
            message: 'Internal server error', 
            error: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
}