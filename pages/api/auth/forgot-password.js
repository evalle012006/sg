import EmailService from "../../../services/booking/emailService";
import { TEMPLATE_IDS } from '../../../services/booking/templateIds';
const jwt = require('jsonwebtoken');
const { User, Guest, AccessToken } = require('./../../../models');

export default async function handler(req, res) {

    if (req.method === 'POST') {

        if (!req.body.email && !req.body.usertype) {
            return res.status(404).send({ 'status': 'error', 'message': 'Email and usertype are required.' });
        }

        let user;

        if (req.body.usertype == 'user') {
            user = await User.findOne({ where: { email: req.body.email } });
        }

        if (req.body.usertype == 'guest') {
            user = await Guest.findOne({ where: { email: req.body.email } });
        }

        //if user doesn't exist return with status 404 and a comprehensive message to display 
        if (user == null) {
            return res.status(404).send({ 'status': 'error', 'message': 'Account with this email doesn\'t exist.' });
        }

        //generate password reset link
        let token = jwt.sign({ email: user.email }, process.env.SECRET);
        let resetLink = process.env.APP_URL + '/auth/forgot-password/' + token + '?email=' + user.email + '&usertype=' + req.body.usertype;

        const accessToken = await AccessToken.create({ token: token, tokenable_id: user.id, tokenable_type: req.body.usertype });
        
        // Send reset link to user using EmailService
        try {
            await EmailService.sendWithTemplate(
                user.email,
                TEMPLATE_IDS.RESET_PASSWORD_LINK,
                {
                    username: user.first_name,
                    reset_link: resetLink
                }
            );
            return res.status(200).send({ 'status': 'success', 'message': 'Password reset link sent.' });
        } catch (emailError) {
            console.error('Error sending password reset email:', emailError);
            return res.status(500).send({ 'status': 'error', 'message': 'Something went wrong. Please try again.' });
        }
    } else {
        return res.status(404).end()
    }
}