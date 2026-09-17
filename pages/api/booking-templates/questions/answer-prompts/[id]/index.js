import { QuestionAnswerPrompt } from "./../../../../../../models"

export default async function handler(req, res) {

    if (req.method === "DELETE") {

        const { id } = req.query;

        await QuestionAnswerPrompt.destroy({ where: { id } });

        return res.status(200).json({ message: "Answer confirmation prompt deleted" })
    }

    return res.status(405).json({ message: "Method not allowed" });
}
