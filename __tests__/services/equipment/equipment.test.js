import { EquipmentService } from '@/services/equipment/equipment.js'
import { Booking, BookingEquipment, Equipment, EquipmentCategory, Guest, QaPair, Section, Supplier, sequelize } from '../../../models';

describe('EquipmentService', () => {
    let equipmentService;
    let guest1;
    let guest2;
    let testCategory;
    let testSupplier;
    let newEquipment;
    let booking1;
    let booking1Section;
    let booking2;
    let booking2Section;
    let bookingEquipment1;
    let bookingEquipment2;

    beforeEach(async () => {
        equipmentService = new EquipmentService();

    });

    beforeAll(async () => {
        guest1 = await Guest.create({
            first_name: 'Test',
            last_name: 'Guest',
            email: 'testuser@test.com',
            created_at: new Date(),
            updated_at: new Date()
        });

        guest2 = await Guest.create({
            first_name: 'Test',
            last_name: 'Guest',
            email: 'testuser2@test.com',
            created_at: new Date(),
            updated_at: new Date()
        });

        testCategory = await EquipmentCategory.create({
            name: 'Test Category',
            created_at: new Date(),
            updated_at: new Date()
        });

        testSupplier = await Supplier.create({
            name: 'Test Supplier',
            created_at: new Date(),
            updated_at: new Date()
        });

        newEquipment = await Equipment.create({
            name: 'Test Equipment',
            category_id: testCategory.id,
            supplier_id: testSupplier.id,
            created_at: new Date(),
            updated_at: new Date()
        });

        booking1 = await Booking.create({
            guest_id: guest1.id,
            created_at: new Date(),
            updated_at: new Date()
        });

        booking1Section = await Section.create({
            model_id: booking1.id,
            model_type: 'booking',
            created_at: new Date(),
            updated_at: new Date()
        });

        await QaPair.create({
            section_id: booking1Section.id,
            question: 'Check In Date and Check Out Date',
            answer: '2022-01-01 - 2022-01-02',
            created_at: new Date(),
            updated_at: new Date()
        });

        booking2 = await Booking.create({
            guest_id: guest2.id,
            created_at: new Date(),
            updated_at: new Date()
        });

        booking2Section = await Section.create({
            model_id: booking2.id,
            model_type: 'booking',
            created_at: new Date(),
            updated_at: new Date()
        });

        await QaPair.create({
            section_id: booking2Section.id,
            question: 'Check In Date and Check Out Date',
            answer: '2022-01-01 - 2022-01-02',
            created_at: new Date(),
            updated_at: new Date()
        });

        bookingEquipment1 = await BookingEquipment.create({
            booking_id: 1,
            equipment_id: newEquipment.id,
            created_at: new Date(),
            updated_at: new Date()
        });

        bookingEquipment2 = await BookingEquipment.create({
            booking_id: 2,
            equipment_id: newEquipment.id,
            created_at: new Date(),
            updated_at: new Date()
        });
    });

    afterAll(async () => {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await sequelize.truncate({ cascade: true });
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Database truncated');
    });

    describe('checkAvailability', () => {
        it('should return true if the equipment is available for the booking', async () => {
            expect(await equipmentService.checkAvailability(newEquipment.id, booking1.id)).toBe(true);
        });

        it('should return false if the equipment is not available for the booking', async () => {
            expect(await equipmentService.checkAvailability(newEquipment.id, booking2.id)).toBe(false);
        });
    });

    describe('generateEquipmentCategoryStatuses', () => {
        it('should return an array of equipment category statuses', async () => {

            const equipmentBookings = await BookingEquipment.findAll({
                where: { equipment_id: newEquipment.id },
                order: [['created_at', 'ASC']]
            });

            const equipmentCategories = await EquipmentCategory.findAll({ include: [{ model: Equipment }] });

            expect(await equipmentService.generateEquipmentCategoryStatuses('2022-01-01', '2022-01-15', equipmentCategories, equipmentBookings)).toEqual([{
                "name": "Test Category",
                "data": [
                    { value: -1, date: '2022-01-01' },
                    { value: -1, date: '2022-01-02' },
                    { value: 1, date: '2022-01-03' },
                    { value: 1, date: '2022-01-04' },
                    { value: 1, date: '2022-01-05' },
                    { value: 1, date: '2022-01-06' },
                    { value: 1, date: '2022-01-07' },
                    { value: 1, date: '2022-01-08' },
                    { value: 1, date: '2022-01-09' },
                    { value: 1, date: '2022-01-10' },
                    { value: 1, date: '2022-01-11' },
                    { value: 1, date: '2022-01-12' },
                    { value: 1, date: '2022-01-13' },
                    { value: 1, date: '2022-01-14' },
                    { value: 1, date: '2022-01-15' }
                ]
            }]);
        });
    });

    describe('getDates', () => {
        it('should return an array of dates within the given date range', () => {
            expect(equipmentService.getDates('2022-01-01', '2022-01-15')).toEqual([
                '2022-01-01',
                '2022-01-02',
                '2022-01-03',
                '2022-01-04',
                '2022-01-05',
                '2022-01-06',
                '2022-01-07',
                '2022-01-08',
                '2022-01-09',
                '2022-01-10',
                '2022-01-11',
                '2022-01-12',
                '2022-01-13',
                '2022-01-14',
                '2022-01-15'
            ]);
        });
    });

    describe('getEquipmentStatus', () => {
        it('should return the equipment and its status for the given booking', async () => {
            await newEquipment.reload();
            expect(await equipmentService.getEquipmentStatus(bookingEquipment1.equipment_id, bookingEquipment1.booking_id)).toEqual({
                equipment: newEquipment,
                data: [
                    { value: -1, date: '2022-01-01' },
                    { value: -1, date: '2022-01-02' }
                ]
            });
        });
    });
});
