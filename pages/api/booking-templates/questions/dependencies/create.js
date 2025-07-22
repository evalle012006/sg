import { QuestionDependency } from "./../../../../../models"

export default async function handler(req, res) {

    if (req.method === "POST") {

        await QuestionDependency.create(req.body);

        return res.status(201).json({ message: "Question dependency created" })
    }

    return res.status(405).json({ message: "Method not allowed" });
}
