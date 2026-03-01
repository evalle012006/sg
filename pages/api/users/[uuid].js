import { User, ModelHasRole, Role, NotificationLibrary } from "../../../models";
import moment from "moment";
import { NotificationService } from "../../../services/notification/notification";

export default async function handler(req, res) {
    const { uuid } = req.query;
    
    const notificationService = new NotificationService();

    if (req.method === 'GET') {
        // GET: Fetch user with roles
        try {
            const user = await User.findOne({ 
                where: { uuid },
                include: [Role] // Include roles for the user
            });

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            return res.status(200).json(user);
        } catch (error) {
            console.error('Error fetching user:', error);
            return res.status(500).json({ message: 'Failed to fetch user' });
        }
    }

    if (req.method === 'DELETE') {
        // DELETE: Delete user
        try {
            const user = await User.findOne({ where: { uuid } });
            
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const notificationLibs = await NotificationLibrary.findOne({ 
                where: { name: 'User Deleted', enabled: true } 
            });

            await User.destroy({ where: { uuid } });

            if (notificationLibs) {
                let message = notificationLibs.notification;
                message = message.replace('[user_email]', user.email);

                const dispatch_date = moment().add(notificationLibs.date_factor, 'days').toDate();
                await notificationService.notificationHandler({
                    notification_to: notificationLibs.notification_to,
                    message: message,
                    link: null,
                    dispatch_date: dispatch_date
                });
            }
            
            return res.status(200).json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error('Error deleting user:', error);
            return res.status(500).json({ message: 'Failed to delete user' });
        }
    }

    if (req.method === 'POST') {
        // POST: Update user
        try {
            const user = await User.findOne({ where: { uuid } });
            
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const notificationLibs = await NotificationLibrary.findOne({ 
                where: { name: 'User Updated', enabled: true } 
            });

            // Update user data
            await User.update(req.body, { where: { uuid } });

            // Handle role update
            if (req.body.hasOwnProperty('role')) {
                const role = await Role.findOne({ where: { name: req.body.role } });
                
                if (role) {
                    const data = { 
                        role_id: role.id, 
                        model_id: user.id, // Use user.id from the found user
                        model_type: 'user' 
                    };
                    
                    const modalHasRole = await ModelHasRole.findOne({ 
                        where: { 
                            model_id: user.id, 
                            model_type: 'user' 
                        } 
                    });

                    if (modalHasRole) {
                        await ModelHasRole.update(data, { 
                            where: { 
                                model_id: user.id, 
                                model_type: 'user' 
                            } 
                        });
                    } else {
                        await ModelHasRole.create(data);
                    }
                }
            }

            if (notificationLibs) {
                let message = notificationLibs.notification;
                message = message.replace('[user_email]', user.email);

                const dispatch_date = moment().add(notificationLibs.date_factor, 'days').toDate();
                await notificationService.notificationHandler({
                    notification_to: notificationLibs.notification_to,
                    message: message,
                    link: null,
                    dispatch_date: dispatch_date
                });
            }

            // Fetch and return updated user with roles
            const updatedUser = await User.findOne({ 
                where: { uuid },
                include: [Role]
            });

            return res.status(200).json({ 
                message: 'User updated successfully', 
                user: updatedUser 
            });
        } catch (error) {
            console.error('Error updating user:', error);
            return res.status(500).json({ message: 'Failed to update user' });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
}