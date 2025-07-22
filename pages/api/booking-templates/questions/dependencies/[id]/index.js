import { QuestionDependency } from "./../../../../../../models"

export default async function handler(req, res) {

    if (req.method === "DELETE") {

        const { id } = req.query;

        await QuestionDependency.destroy({ where: { id } });

        return res.status(200).json({ message: "Question condition/dependency deleted" })
    }

    return res.status(405).json({ message: "Method not allowed" });
}
