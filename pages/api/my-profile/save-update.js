import { Guest, HealthInfo, GuestFunding, Package, sequelize } from '../../../models';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const {
            guest_id,
            // Guest fields
            first_name, last_name, email, phone_number, gender, dob, profile_filename, flags,
            address_street1, address_street2, address_city, address_state_province, address_postal, address_country,
            // Health fields
            identify_aboriginal_torres, language, require_interpreter, cultural_beliefs,
            emergency_name, emergency_mobile_number, emergency_email, emergency_relationship,
            specialist_name, specialist_mobile_number, specialist_practice_name,
            sci_year, sci_injury_type, sci_level_asia, sci_intial_spinal_rehab, sci_type, sci_type_level, sci_other_details, sci_inpatient,
            // Funding fields
            approval_number, nights_approved, package_id, package_approved, approval_from, approval_to
        } = req.body;

        if (!guest_id) {
            return res.status(400).json({ message: 'Guest ID is required' });
        }

        // Verify guest exists
        const existingGuest = await Guest.findByPk(parseInt(guest_id));
        if (!existingGuest) {
            return res.status(404).json({ message: 'Guest not found' });
        }

        // Helper function to safely process sci_type_level
        const processSciTypeLevel = (value) => {
            if (!value) return null;
            
            // If it's already an array, convert to comma-separated string for storage
            if (Array.isArray(value)) {
                return value.length > 0 ? value.join(',') : null;
            }
            
            // If it's a string, keep as is
            if (typeof value === 'string') {
                return value.trim() || null;
            }
            
            return null;
        };

        // Start transaction for data consistency
        const result = await sequelize.transaction(async (transaction) => {
            let responseData = {};

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
            if (sci_injury_type !== undefined) healthUpdateData.sci_injury_type = sci_injury_type || null;
            if (sci_level_asia !== undefined) healthUpdateData.sci_level_asia = sci_level_asia || null;
            if (sci_intial_spinal_rehab !== undefined) healthUpdateData.sci_intial_spinal_rehab = sci_intial_spinal_rehab || null;
            if (sci_type !== undefined) healthUpdateData.sci_type = sci_type || null;
            if (sci_type_level !== undefined) healthUpdateData.sci_type_level = processSciTypeLevel(sci_type_level);
            if (sci_other_details !== undefined) healthUpdateData.sci_other_details = sci_other_details || null;
            if (sci_inpatient !== undefined) {
                healthUpdateData.sci_inpatient = sci_inpatient === true ? true : 
                                               sci_inpatient === false ? false : null;
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

            // 3. HANDLE FUNDING INFORMATION (UPDATED to handle both package_id and package_approved)
            const fundingUpdateData = {};
            if (approval_number !== undefined) fundingUpdateData.approval_number = approval_number || null;
            if (nights_approved !== undefined) fundingUpdateData.nights_approved = parseInt(nights_approved) || null;

            // NEW: Handle package_id (foreign key) with validation
            if (package_id !== undefined) {
                if (package_id) {
                    // Validate that the package exists
                    const packageExists = await Package.findByPk(package_id);
                    if (!packageExists) {
                        return res.status(400).json({ 
                            message: 'Invalid package selected. Package does not exist.' 
                        });
                    }
                    fundingUpdateData.package_id = package_id;
                } else {
                    fundingUpdateData.package_id = null;
                }
            } 
            // BACKWARD COMPATIBILITY: Handle old package_approved field
            else if (package_approved !== undefined) {
                // Try to find package by name/code for backward compatibility
                let packageId = null;
                
                if (package_approved) {
                    const packageByName = await Package.findOne({
                        where: {
                            [Package.sequelize.Sequelize.Op.or]: [
                                { name: package_approved },
                                Package.sequelize.Sequelize.literal(`CONCAT(name, ' (', package_code, ')') = '${package_approved.replace(/'/g, "''")}'`)
                            ]
                        }
                    });
                    
                    if (packageByName) {
                        packageId = packageByName.id;
                    }
                }
                
                fundingUpdateData.package_id = packageId;
            }

            if (approval_from !== undefined) fundingUpdateData.approval_from = approval_from || null;
            if (approval_to !== undefined) fundingUpdateData.approval_to = approval_to || null;

            let fundingResult = null;
            if (Object.keys(fundingUpdateData).length > 0) {
                // Check if funding info already exists
                const existingFundingInfo = await GuestFunding.findOne({ 
                    where: { guest_id: parseInt(guest_id) },
                    transaction,
                    include: [
                        {
                            model: Package,
                            as: 'package',
                            attributes: ['id', 'name', 'package_code', 'funder']
                        }
                    ]
                });

                if (existingFundingInfo) {
                    // Update existing funding info
                    await GuestFunding.update(fundingUpdateData, {
                        where: { guest_id: parseInt(guest_id) },
                        transaction
                    });
                    
                    // Fetch updated record with package details
                    fundingResult = await GuestFunding.findOne({ 
                        where: { guest_id: parseInt(guest_id) },
                        transaction,
                        include: [
                            {
                                model: Package,
                                as: 'package',
                                attributes: ['id', 'name', 'package_code', 'funder']
                            }
                        ]
                    });
                } else {
                    // Create new funding info record
                    fundingResult = await GuestFunding.create({
                        guest_id: parseInt(guest_id),
                        ...fundingUpdateData
                    }, { transaction });
                    
                    // Fetch created record with package details
                    if (fundingResult) {
                        fundingResult = await GuestFunding.findOne({ 
                            where: { id: fundingResult.id },
                            transaction,
                            include: [
                                {
                                    model: Package,
                                    as: 'package',
                                    attributes: ['id', 'name', 'package_code', 'funder']
                                }
                            ]
                        });
                    }
                }
            }

            // 4. FETCH UPDATED GUEST DATA FOR RESPONSE
            const updatedGuest = await Guest.findByPk(parseInt(guest_id), { transaction });
            responseData = { ...updatedGuest.toJSON() };

            // Include health info in response
            if (healthResult) {
                responseData.HealthInfo = healthResult.toJSON();
            }

            // Include funding info in response with proper package details
            if (fundingResult) {
                const fundingData = fundingResult.toJSON();
                
                // Format package display name for backward compatibility
                let packageDisplay = '';
                if (fundingData.package) {
                    packageDisplay = fundingData.package.package_code 
                        ? `${fundingData.package.name} (${fundingData.package.package_code})`
                        : fundingData.package.name;
                }
                
                responseData.funding = {
                    approval_number: fundingData.approval_number || '',
                    nights_approved: fundingData.nights_approved || '',
                    package_id: fundingData.package_id || null,
                    package_approved: packageDisplay, // For display/backward compatibility
                    approval_from: fundingData.approval_from || '',
                    approval_to: fundingData.approval_to || ''
                };
            }

            return responseData;
        });

        // Success response
        const updateMessage = 'Profile information updated successfully';
        
        return res.status(200).json({
            message: updateMessage,
            data: result
        });

    } catch (error) {
        console.error('Error in my-profile save-update:', error);
        
        // Handle specific validation errors
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
                message: 'Invalid reference: Guest does not exist.'
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