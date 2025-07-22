const _ = require('lodash');
const jwt = require('jsonwebtoken');
const { User, Guest, AccessToken } = require('./../../../models');

const { getPasswordHash } = require('./../../../utilities/authentication');

async function changePassword({ model, email, data, res }) {


    const user = await model.findOne({ where: { email: email } });
    const tokens = await AccessToken.findAll({ where: { tokenable_id: user.id, tokenable_type: data.usertype } })
        .then(tokens => _.map(tokens, token => token.token));

    if (!tokens.includes(data.token)) {
        return res.status(400).send({ 'status': 'error', 'message': 'Invalid request. Please request for a new reset link and try again.' })
    }
    await user.update({ password: await getPasswordHash(data.password) });
    await AccessToken.destroy({ where: { tokenable_id: user.id, tokenable_type: data.usertype } });

    return res.status(200).send({ 'status': 'success', 'message': 'Password reset successful.' })
}

export default async function handler(req, res) {
    if (req.method === 'POST') {

        //verify password reset link
        let decoded;
        try{
            decoded = jwt.verify(req.body.token, process.env.SECRET);
        }catch (e){
            return res.status(400).send({ 'status': 'error', 'message': 'Invalid link. Please request for a new reset link and try again.' })
        }

        const prep_data = {
            email: decoded.email,
            data: req.body,
            res: res
        }

        if (req.body.usertype == 'user') {
            prep_data.model = User;
            await changePassword(prep_data);
        }

        if (req.body.usertype == 'guest') {
            prep_data.model = Guest;
            await changePassword(prep_data);
        }

    } else {
        return res.status(404).end()
    }
}