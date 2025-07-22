const jwt = require("jsonwebtoken");
const { Sequelize, sequelize } = require("./../../../models");
import sendMail from "../../../utilities/mail";
import { getPasswordHash } from "../../../utilities/authentication";

const Guest = require("../../../models/guest");
const AccessToken = require("./../../../models/accesstoken");

async function handler(req, res) {
  const guestModel = Guest(sequelize, Sequelize.DataTypes);
  const accessTokenModel = AccessToken(sequelize, Sequelize.DataTypes);

  if (req.method === "POST") {

    const data = req.body;

    const user = await guestModel.findAll({
      where: {
        email: data.email,
      },
    });

    if (user.length > 0) {
      return res.status(409).json({ message: "User already exist." });
    }

    const hashedPassword = await getPasswordHash(data.password);

    const guest = await guestModel.create({ ...data, ...{ password: hashedPassword } });

    let token = jwt.sign({ email: guest.email, user_type: 'guest' }, process.env.SECRET);
    let confirmLink = process.env.APP_URL + `/auth/confirm-email/${token}`;

    const accessToken = await accessTokenModel.create({
      token: token,
      tokenable_id: guest.id,
      tokenable_type: "guest",
    });

    const sentEmail = await sendMail(
      guest.email,
      "Sargood - Email Confirmation",
      "email-confirmation-link",
      { username: guest.first_name, confirm_link: confirmLink }
    );

    return res.status(200)
      .json({ users: guest, emailSent: sentEmail, token: accessToken });

  } else {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
}

export default handler;
