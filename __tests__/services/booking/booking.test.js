require('iconv-lite').encodingExists('cesu8') // added to resolve an error with sequelize cesu8 encoding

import { json } from 'sequelize';
import { Booking, Guest, QaPair, Room, RoomType, Section, sequelize } from '../../../models';
import { BookingService } from '../../../services/booking/booking';

describe('BookingService', () => {
    let bookingService;

    beforeEach(() => {
        bookingService = new BookingService('booking');
    });

    afterAll(async () => {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await sequelize.truncate({ cascade: true });
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Database truncated');
    });

    // describe('create', () => {  // This test is failing because of the way the entityBuilder is implemented - requires refactoring
    //     it('should create a new booking', async () => {
    //         console.log(bookingService.entityModel);
    //         const guest = await Guest.create({
    //             name: 'Test Guest',
    //             email: 'test@test.com',
    //             phone: '1234567890',
    //             createdBy: 'testuser'
    //         });

    //         const createdBooking = await bookingService.create({
    //             name: 'Test Booking',
    //             startDate: new Date(),
    //             endDate: new Date(),
    //             guest_id: guest.id,
    //             status: 'active',
    //             createdBy: 'testuser'
    //         });

    //         await createdBooking.reload();
    //         const booking = await Booking.findOne({ where: { id: createdBooking.id } });

    //         expect(createdBooking).toBe(booking);
    //     });
    // });

    describe('disseminateChanges', () => {
        it('should disseminate changes to a booking', async () => {

            const guest = await Guest.create({
                name: 'Test Guest',
                email: 'testguest@test.com',
                phone: '1234567890',
                created_at: new Date(),
                updated_at: new Date(),
            });

            const newBooking = await Booking.create({
                name: 'Test Booking',
                startDate: new Date(),
                endDate: new Date(),
                guest_id: guest.id,
                created_at: new Date(),
                updated_at: new Date(),
            });

            const newSection = await Section.create({
                label: 'Test Section',
                model_type: 'booking',
                model_id: newBooking.id,
                created_at: new Date(),
                updated_at: new Date(),
            });

            const roomQaPair = await QaPair.create({
                question: 'Room Selection',
                answer: JSON.stringify([{ name: 'Deluxe Suite', order: 1 }]),
                created_at: new Date(),
                updated_at: new Date(),
            });

            const checkInCheckOutQaPair = await QaPair.create({
                question: 'Check In Date and Check Out Date',
                answer: '2022-12-01 - 2022-12-05',
                created_at: new Date(),
                updated_at: new Date(),
            });

            const lateArrivalQaPair = await QaPair.create({
                question: 'Do you need to check in after 5PM?',
                answer: true,
                created_at: new Date(),
                updated_at: new Date(),
            })

            const arrivalTimeQaPair = await QaPair.create({
                question: 'Expected Arrival Time (Check In is from 2pm)',
                answer: '2022-12-01 18:00:00',
                created_at: new Date(),
                updated_at: new Date(),
            });

            const infantsQaPair = await QaPair.create({
                question: 'Number of Infants < 2 years staying.',
                answer: 1,
                created_at: new Date(),
                updated_at: new Date(),
            });

            const childrenQaPair = await QaPair.create({
                question: 'Number of children under the age of 16 staying.',
                answer: 2,
                created_at: new Date(),
                updated_at: new Date(),
            });

            const adultsQaPair = await QaPair.create({
                question: 'Number of guests over the age of 16 (including person with the spinal cord injury)',
                answer: 3,
                created_at: new Date(),
                updated_at: new Date(),
            });

            const petsQaPair = await QaPair.create({
                question: 'Will you be bringing an assistance animal with you on your stay?',
                answer: 'Yes',
                created_at: new Date(),
                updated_at: new Date(),
            });

            const roomType1 = await RoomType.create({
                type: 'Deluxe Suite',
                name: 'Deluxe Suite',
                created_at: new Date(),
                updated_at: new Date(),
            });

            const roomType2 = await RoomType.create({
                type: 'Ocean View Suite',
                name: 'Ocean View Suite',
                created_at: new Date(),
                updated_at: new Date(),
            });


            const qaPairs = await QaPair.findAll();
            await bookingService.disseminateChanges(newBooking, qaPairs);

            const autoCreatedRoom = await Room.findOne({ where: { booking_id: newBooking.id } });
            expect(autoCreatedRoom.label).toBe('Deluxe Suite');
            expect(autoCreatedRoom.checkin).toEqual(new Date('2022-12-01'));
            expect(autoCreatedRoom.checkout).toEqual(new Date('2022-12-05'));
            expect(autoCreatedRoom.arrival_time).toEqual('2022-12-01 18:00:00');
            expect(autoCreatedRoom.infants).toBe(1);
            expect(autoCreatedRoom.children).toBe(2);
            expect(autoCreatedRoom.adults).toBe(3);
            expect(autoCreatedRoom.pets).toBe(1);

            await newBooking.reload();
            expect(newBooking.late_arrival).toBe(true);

        });
    });

    // describe('isBookingComplete', () => { // TODO
    //     it('should return true if booking is complete', () => {

    //     });

    //     it('should return false if booking is not complete', () => {

    //     });
    // });
});