const { Sequelize, sequelize } = require("./../../../models");
const jwt = require("jsonwebtoken");

const User = require("../../../models/user");
const AccessToken = require("./../../../models/accesstoken");

async function handler(req, res) {

  const userModel = User(sequelize, Sequelize.DataTypes);
  const accessTokenModel = AccessToken(sequelize, Sequelize.DataTypes);

  if (req.method === "POST") {
    const { token } = req.body;

    const myToken = await accessTokenModel.findOne({
      where: {
        token: token,
      },
    });

    if (!myToken) {
      return res.status(409).json({ message: "Token does not exist." });
    }

    const decoded = jwt.verify(myToken.token, process.env.SECRET);

    if (!decoded) {
      return res.status(409).json({ message: "Invalid Token" });

    }


    const updateUser = await userModel.update(
      { email_verified: 1 },
      {
        where: {
          id: myToken.tokenable_id,
        },
      }
    );

    await accessTokenModel.destroy({
      where: {
        id: myToken.id,
      },
    });

    return res.status(201).json({ message: "Email Successfully verified", user: updateUser });
  } else {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
}

export default handler;