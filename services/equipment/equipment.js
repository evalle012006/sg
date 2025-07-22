import { BookingEquipment, Booking, Section, QaPair, EquipmentCategory, Equipment } from './../../models';
import moment from 'moment';
export class EquipmentService {
    /**
 * Checks the availability of equipment for a given booking.
 * @param {number} equipmentId - The ID of the equipment.
 * @param {number} bookingId - The ID of the booking.
 * @param {Array} equipmentBookingsList - The list of equipment bookings (optional).
 * @returns {boolean} - Returns true if the equipment is available for the booking, false otherwise.
 */
    checkAvailability = async (equipmentId, bookingId, equipmentBookingsList = null) => {

        let equipmentBookings;

        if (equipmentBookingsList === null) {
            equipmentBookings = await BookingEquipment.findAll({
                where: { equipment_id: equipmentId },
                order: [['created_at', 'ASC']]
            });
        } else {
            equipmentBookings = equipmentBookingsList;
        }
        const currentBookingEquipment = equipmentBookings.find(bookingEquipment => bookingEquipment.booking_id == bookingId);
        const filteredEquipmentBookings = equipmentBookings.filter(equipmentBooking => {
            let inDateRange = false;

            if (equipmentBooking.start_date >= currentBookingEquipment.start_date && equipmentBooking.start_date <= currentBookingEquipment.end_date ||
                equipmentBooking.end_date >= currentBookingEquipment.start_date && equipmentBooking.end_date <= currentBookingEquipment.end_date) {
                inDateRange = true;
            } else {
                inDateRange = false;
            }

            return inDateRange;
        });

        return filteredEquipmentBookings.length > 0 && filteredEquipmentBookings[0].booking_id == bookingId;

    }

        /**
 * Checks the availability of equipment for a given booking.
 * @param {number} equipmentId - The ID of the equipment.
 * @param {number} bookingId - The ID of the booking.
 * @param {string} startDate - The start date of the range.
 * @param {string} endDate - The end date of the range.
 * @param {Array} equipmentBookingsList - The list of equipment bookings (optional).
 * @returns {boolean} - Returns true if the equipment is available for the booking, false otherwise.
 */
        checkAvailabilityInRange = async (equipmentId, bookingId, startDate, endDate, equipmentBookingsList = null) => {

            let equipmentBookings;
    
            if (equipmentBookingsList === null) {
                equipmentBookings = await BookingEquipment.findAll({
                    where: { equipment_id: equipmentId },
                    order: [['created_at', 'ASC']]
                });
            } else {
                equipmentBookings = equipmentBookingsList;
            }
            const filteredEquipmentBookings = equipmentBookings.filter(equipmentBooking => {
                let inDateRange = false;
    
                if (equipmentBooking.start_date >= startDate && equipmentBooking.start_date <= endDate ||
                    equipmentBooking.end_date >= startDate && equipmentBooking.end_date <= endDate) {
                    inDateRange = true;
                } else {
                    inDateRange = false;
                }
    
                return inDateRange;
            });
    
            return filteredEquipmentBookings.length > 0 && filteredEquipmentBookings[0].booking_id == bookingId;
    
        }

    /**
 * Gets the status of equipment categories within a given date range.
 * @param {string} startDate - The start date of the range.
 * @param {string} endDate - The end date of the range.
 * @returns {Array} - An array of equipment category statuses.
 */
    getEquipmentCategoryStatus = async (startDate, endDate) => {

        const equipmentCategories = await EquipmentCategory.findAll({ include: [{ model: Equipment }] });
        const bookingEquipments = await BookingEquipment.findAll({
            order: [['created_at', 'ASC']]
        });

        const equipmentCategoryStatus = this.generateEquipmentCategoryStatuses(startDate, endDate, equipmentCategories, bookingEquipments);

        return equipmentCategoryStatus;

    }



    /**
     * Generates equipment category statuses within a given date range.
     * @param {string} startDate - The start date of the range.
     * @param {string} endDate - The end date of the range.
     * @param {Array} equipmentCategories - The array of equipment categories.
     * @param {Array} bookingEquipments - The array of booking equipments.
     * @returns {Array} - An array of equipment category statuses.
     */
    generateEquipmentCategoryStatuses = async (startDate, endDate, equipmentCategories, bookingEquipments) => {
        const equipmentCategoryStatus = [];
        const dates = this.getDates(startDate, endDate);

        equipmentCategories.map(async equipmentCategory => {
            const category = {
                name: equipmentCategory.name,
                data: []
            }

            dates.forEach(date => {
                let value = equipmentCategory.Equipment.length;
                equipmentCategory.Equipment.map(equipment => {
                    const filteredBookingEquipments = bookingEquipments.filter(bookingEquipment => bookingEquipment.equipment_id == equipment.id);
                    if (filteredBookingEquipments.length > 0) {
                        filteredBookingEquipments.forEach(bookingEquipment => {
                            if (moment(date).isSameOrAfter(bookingEquipment.start_date, 'day') && moment(bookingEquipment.end_date).isSameOrAfter(date, 'day')) {
                                value--;
                            }
                        });
                    }
                });
                category.data.push({ value, date });
            });

            equipmentCategoryStatus.push(category);

        });

        return equipmentCategoryStatus;
    }

    /**
 * Gets an array of dates within a given date range.
 * @param {string} startDate - The start date of the range.
 * @param {string} endDate - The end date of the range.
 * @returns {Array} - An array of dates.
 */
    getDates = (startDate, endDate) => {
        let dates = [];
        let currentDate = moment(startDate);
        while (currentDate <= moment(endDate)) {
            dates.push(currentDate.format('YYYY-MM-DD'));
            currentDate = currentDate.add(1, 'days');
        }
        return dates;
    }

    /**
 * Gets the status of a specific equipment for a given booking.
 * @param {number} equipmentId - The ID of the equipment.
 * @param {number} bookingId - The ID of the booking.
 * @returns {Object} - An object containing the equipment and its status.
 */
    getEquipmentStatus = async (equipmentId, bookingId) => {

        const equipment = await Equipment.findOne({ where: { id: equipmentId } });

        const currentBookingEquipment = await BookingEquipment.findOne({
            where: { booking_id: bookingId, equipment_id: equipmentId }
        });

        const equipmentStatus = [];
        if (currentBookingEquipment.start_date && currentBookingEquipment.end_date) {
            const dates = this.getDates(currentBookingEquipment.start_date, currentBookingEquipment.end_date);


            const bookingEquipments = await BookingEquipment.findAll({
                order: [['created_at', 'ASC']]
            });

            const equipments = await Equipment.findAll({ where: { name: equipment.name } });

            dates.forEach(date => {
                let value = equipments.length;
                const filteredBookingEquipments = bookingEquipments.filter(bookingEquipment => bookingEquipment.equipment_id == equipment.id);
                if (filteredBookingEquipments.length > 0) {
                    filteredBookingEquipments.forEach(bookingEquipment => {
                        if (date >= bookingEquipment.start_date && bookingEquipment.end_date >= date) {
                            value--;
                        }
                    });
                }

                equipmentStatus.push({ value, date });
            });
        }

        return { equipment, data: equipmentStatus };
    }

}