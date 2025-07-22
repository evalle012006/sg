import { AccessToken, Guest, User } from "../../../models";
const jwt = require("jsonwebtoken");

async function handler(req, res) {
    if (req.method === "POST") {
        const { token } = req.body;

        let user;
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.SECRET);
            console.log('decodedToken', decodedToken)
            const { email, user_type } = decodedToken;


            if (user_type === 'guest') {
                user = await Guest.findOne({
                    where: {
                        email: email,
                    },
                });
            } else {
                user = await User.findOne({
                    where: {
                        email: email,
                    },
                });
            }

            const accessToken = await AccessToken.findOne({
                where: {
                    token: token,
                    tokenable_id: user.id,
                    tokenable_type: user_type,
                },
            });

            if (accessToken == null || accessToken.length === 0) {
                return res.status(409).json({ message: "Invalid Credentials" });
            }

            if (user_type === 'guest') {
                await Guest.update({ email_verified: true }, { where: { email: email } });
            }

            return res.status(200).json({ message: "Token validation successfull", status: "valid", email: email, user_type: user_type });
        }
        catch (err) {
            return res.status(409).json({ message: "Invalid Credentials" });
        }
    }

    return res.status(405).json({ message: "Method Not Allowed" });
}

export default handler;