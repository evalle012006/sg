import { Comment, User } from '../../../../models';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            // req.body is already parsed by Next.js - no need for JSON.parse()
            const { user_id, guest_id, title, message } = req.body;
            
            // Validate required fields
            if (!user_id || !guest_id || !title || !message) {
                return res.status(400).json({ 
                    error: true,
                    message: 'Missing required fields' 
                });
            }

            // Check if user exists
            const user = await User.findOne({ where: { id: user_id } });
            
            if (!user) {
                return res.status(404).json({ 
                    error: true,
                    message: 'User not found' 
                });
            }
            
            // Create the comment
            const comment = await Comment.create({
                title,
                message,
                guest_id,
                user_id
            });
            
            console.log('New comment created:', comment.id);
            
            // Return comment with user data
            const commentWithUser = {
                id: comment.id,
                title: comment.title,
                message: comment.message,
                guest_id: comment.guest_id,
                user_id: comment.user_id,
                createdAt: comment.createdAt,
                updatedAt: comment.updatedAt,
                User: {
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email
                }
            };
            
            return res.status(200).json(commentWithUser);
            
        } catch (err) {
            console.error('Error creating comment:', err);
            return res.status(500).json({ 
                error: true, 
                message: err.message || 'Internal server error'
            });
        }
    }

    return res.status(405).json({ 
        error: true,
        message: 'Method not allowed' 
    });
}