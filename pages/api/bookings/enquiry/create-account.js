import { AccessToken, Guest, NotificationLibrary, sequelize } from "../../../../models";
import { Op } from "sequelize";
import moment from 'moment';
import { NotificationService } from "../../../../services/notification/notification";
import EmailService from "../../../../services/booking/emailService";
import { TEMPLATE_IDS } from '../../../../services/booking/templateIds';
const jwt = require('jsonwebtoken');

export default async function handler(request, response) {
    const data = JSON.parse(request.body);

    const transaction = await sequelize.transaction()

    const token = jwt.sign({ email: data.email, user_type: 'guest' }, process.env.SECRET);

    try {
        const notificationLibs = await NotificationLibrary.findOne({ where: {[Op.or]: [ {name: 'New Account'} ], enabled: true} }, { transaction });
        const notificationService = new NotificationService();
        const guest = await Guest.create(data, { transaction });

        const accessToken = await AccessToken.create({ token: token, tokenable_id: guest.id, tokenable_type: 'guest' });

        await transaction.commit();

        if (guest) {
            for (let index = 0; index < notificationLibs.length; index++) {
                const lib = notificationLibs[index];
                let message = lib.notification;
    
                message = message.replace('[guest_email]', guest.email);
    
                const dispatch_date = moment().add(lib.date_factor, 'days').toDate();
                await notificationService.notificationHandler({
                    notification_to: lib.notification_to,
                    message: message,
                    link: null,
                    dispatch_date: dispatch_date
                });
            }
        }

        // Send account creation email using EmailService
        try {
            await EmailService.sendWithTemplate(
                data.email,
                TEMPLATE_IDS.CREATE_ACCOUNT,
                {
                    username: data.first_name,
                    create_password_link: `${process.env.APP_URL}/auth/onboarding/set-new-password?token=${accessToken.token}`
                }
            );
        } catch (emailError) {
            console.error('Error sending account creation email:', emailError);
            // Don't fail the request if email fails
        }

    } catch (error) {
        let message = error.errors ? { error: error.errors.map(e => e.message)[0], type: error.errors.map(e => e.type)[0] } : { error: "Something went wrong", type: "error" };
        response.status(403).json(message);
        console.log('ERROR MESSAGE FROM SEQUELIZE', error);
        await transaction.rollback();
    }

    response.status(200).end();
}