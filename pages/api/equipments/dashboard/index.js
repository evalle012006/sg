import { Booking, BookingEquipment, Equipment, EquipmentCategory, QaPair, Section } from '../../../../models';
import moment from 'moment';
import { generateMonthsArray } from '../../../../utilities/common';
import { EquipmentService } from '../../../../services/equipment/equipment';

export default async function handler(req, res) {

    const { startDate, endDate } = req.query;

    let equipmentStats = {
        active: 0,
        require_maintenance: 0,
        require_hiring: 0,
        decommissioned: 0,
        needs_maintenance: 0,
        being_repaired: 0,
        expiring_soon: 0,
        new: 0,
        warranty_expired: 0,
        booked: 0,
        available: 0,
        total_assets: 0,
        categories: [],
        available_data: {
            labels: [],
            available: [],
            booked: [],
        },
    };

    const equipments = await Equipment.findAll({ where: { hidden: false } });
    const equipmentCategories = await EquipmentCategory.findAndCountAll({ include: [{ model: Equipment, separate: true }] });
    const BookingEquipments = await BookingEquipment.findAll({
        order: [['created_at', 'ASC']]
    });

    const equipmentService = new EquipmentService();

    equipmentStats.total_assets = equipments.length;

    for (const index in equipments) {
        const equipment = equipments[index];
        if (equipment.status === 'Active') {
            equipmentStats.active++;
        }

        if (equipment.status === 'Require Maintenance') {
            equipmentStats.require_maintenance++;
        }

        if (equipment.status === 'decommissioned') {
            equipmentStats.decommissioned++;
        }

        if (equipment.status === 'Needs Maintenance') {
            equipmentStats.needs_maintenance++;
        }

        if (equipment.status == 'Under Maintenance') {
            equipmentStats.being_repaired++;
        }

        if (moment(equipment.next_service_date).month() === moment().month()) {
            equipmentStats.needs_maintenance++;
        }

        if (moment(equipment.warranty_period).month() === moment().month()) {
            equipmentStats.expiring_soon++;
        }

        if (moment(equipment.purchase_date).month() === moment().month()) {
            equipmentStats.new++;
        }

        if (moment(equipment.warranty_period).isBefore(moment())) {
            equipmentStats.warranty_expired++;
        }

        const equipmentFound = BookingEquipments.find(bookingEquipment => bookingEquipment.equipment_id === equipment.id);
        if (equipmentFound) {
            const availablilityStatus = await equipmentService.checkAvailabilityInRange(equipment.id, equipmentFound.booking_id, startDate, endDate, BookingEquipments);
            if (!availablilityStatus == true) {
                equipmentStats.booked++;
            } else {
                equipmentStats.available++;
            }
        } else {
            equipmentStats.available++;
        }
    }

    const equipmentCategoryStatus = await equipmentService.generateEquipmentCategoryStatuses(startDate, endDate, equipmentCategories.rows, BookingEquipments);

    for (const categoryIndex in equipmentCategoryStatus) {
        for (const eachDayIndex in equipmentCategoryStatus[categoryIndex].equipmentStats) {
            if (equipmentCategoryStatus[categoryIndex].equipmentStats[eachDayIndex].value < 0) {
                equipmentStats.require_hiring = equipmentStats.require_hiring + Math.abs(equipmentCategoryStatus[categoryIndex].equipmentStats[eachDayIndex].value);
            }
        }
    };

    equipmentCategories.rows.map(category => {
        if (category.Equipment) {
            equipmentStats['categories'].push({ name: category.name, count: category.Equipment.length });
        } else {
            equipmentStats['categories'].push({ name: category.name, count: 0 });
        }
    });

    const monthsArray = generateMonthsArray();

    for (const index in monthsArray) {
        const month = monthsArray[index];
        const startDate = moment(month).startOf('month').format('YYYY-MM-DD');
        const endDate = moment(month).endOf('month').format('YYYY-MM-DD');
        let availableEquipment = 0;
        let bookedEquipment = 0;

        for (const equipmentIndex in equipments) {
            const equipment = equipments[equipmentIndex];
            const equipmentFound = BookingEquipments.find(bookingEquipment => bookingEquipment.equipment_id === equipment.id);
            if (equipmentFound) {
                const availablilityStatus = await equipmentService.checkAvailabilityInRange(equipment.id, equipmentFound.booking_id, startDate, endDate, BookingEquipments);
                if (!availablilityStatus == true) {
                    bookedEquipment++;
                } else {
                    availableEquipment++;
                }
            } else {
                availableEquipment++;
            }
        }

        equipmentStats.available_data.labels.push(moment(month).format('MMM YYYY'));
        equipmentStats.available_data.available.push(availableEquipment);
        equipmentStats.available_data.booked.push(bookedEquipment);
    }

    return res.status(200).json(equipmentStats);
}