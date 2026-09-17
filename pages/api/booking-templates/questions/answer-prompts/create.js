import { QuestionAnswerPrompt } from "./../../../../../models"

export default async function handler(req, res) {

    if (req.method === "POST") {

        const prompt = await QuestionAnswerPrompt.create(req.body);

        return res.status(201).json({ message: "Answer confirmation prompt created", prompt })
    }

    return res.status(405).json({ message: "Method not allowed" });
}
