import { Comment, User } from '../../../../models';

export default async function handler(req, res) {

    if (req.method == 'POST') {

        const user = await User.findOne({ where: { id: JSON.parse(req.body).user_id } });
        await Comment.create(JSON.parse(req.body)).then(comment => {
            console.log('new comment: ' + comment)
            return res.status(200).send({ ...comment.dataValues, User: user });
        }).catch(err => {
            return res.status(400).send({ message: err.message });
        });
    }

    return res.status(400).send({ message: 'Invalid request method' });
}