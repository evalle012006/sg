

/**
 * Generate careData array for new date range using defaultValues
 * @param {Object} existingCareData - Existing care data with defaultValues
 * @param {string} checkInDate - New check-in date
 * @param {string} checkOutDate - New check-out date
 * @returns {Object} New care data structure with populated careData
 */
export const regenerateCareDataForNewDates = (existingCareData, checkInDate, checkOutDate) => {
    const defaultValues = existingCareData?.defaultValues || {
        morning: { carers: '', time: '', duration: '' },
        afternoon: { carers: '', time: '', duration: '' },
        evening: { carers: '', time: '', duration: '' }
    };
    
    const careVaries = existingCareData?.careVaries ?? null;
    
    // Generate new date range
    const newDates = generateDateRangeForCare(checkInDate, checkOutDate);
    
    // console.log('📅 Generating care data for dates:', {
    //     checkInDate,
    //     checkOutDate,
    //     dateCount: newDates.length,
    //     careVaries,
    //     defaultValues
    // });
    
    // If no dates generated, return with empty careData
    if (newDates.length === 0) {
        return {
            careData: [],
            defaultValues: defaultValues,
            careVaries: careVaries
        };
    }
    
    // Generate careData entries for each date
    const newCareData = [];
    
    newDates.forEach(dateStr => {
        ['morning', 'afternoon', 'evening'].forEach(period => {
            const defaultForPeriod = defaultValues[period];
            
            // Only add entry if care is required for this period
            if (defaultForPeriod && 
                defaultForPeriod.carers && 
                !isNoCareRequired(defaultForPeriod.carers)) {
                
                newCareData.push({
                    care: period,
                    date: dateStr,
                    values: {
                        carers: defaultForPeriod.carers,
                        time: defaultForPeriod.time || '',
                        duration: defaultForPeriod.duration || ''
                    }
                });
            }
        });
    });
    
    // console.log('📅 Generated care data entries:', newCareData.length);
    
    return {
        careData: newCareData,
        defaultValues: defaultValues,
        careVaries: careVaries
    };
};

/**
 * Generate date range array from check-in to check-out
 * @param {string} startDateStr - Check-in date (DD/MM/YYYY or YYYY-MM-DD)
 * @param {string} endDateStr - Check-out date (DD/MM/YYYY or YYYY-MM-DD)
 * @returns {string[]} Array of dates in DD/MM/YYYY format
 */
const generateDateRangeForCare = (startDateStr, endDateStr) => {
    const dates = [];
    
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        
        // Format: DD/MM/YYYY
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
        }
        // Format: YYYY-MM-DD
        else if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                const [year, month, day] = parts;
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
        }
        
        return null;
    };
    
    const startDate = parseDate(startDateStr);
    const endDate = parseDate(endDateStr);
    
    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('Invalid dates for care data generation:', { startDateStr, endDateStr });
        return [];
    }
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        // Format as DD/MM/YYYY
        const day = String(currentDate.getDate()).padStart(2, '0');
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const year = currentDate.getFullYear();
        dates.push(`${day}/${month}/${year}`);
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
};

/**
 * Check if a carers value means "no care required"
 */
const isNoCareRequired = (value) => {
    if (!value) return true;
    const normalizedValue = String(value).toLowerCase().trim();
    return normalizedValue === '' || 
           normalizedValue === 'no care required' || 
           normalizedValue === 'no' ||
           normalizedValue === 'none';
};