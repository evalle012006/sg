const jwt = require("jsonwebtoken");
const { User, Role, ModelHasRole } = require("../../../models/index");

async function handler(req, res) {
  if (req.method === "GET") {
    const users = await User.findAll({ where: { root: false }, include: [Role] });
    return res
      .status(201)
      .json({ message: "Successfully Fetched", users: users });

  } else {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
}

export default handler;
