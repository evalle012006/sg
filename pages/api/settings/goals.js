import { Setting } from '../../../models';

export default async function handler(request, response) {
    try {
        if (request.method === 'GET') {
            const goals = await Setting.findAll({ where: { attribute: 'exercise_goal' } });
            return response.status(200).json(goals);
        } 
        
        else if (request.method === 'POST') {
            const data = JSON.parse(request.body);
            const { id, value } = data;
            
            const goalData = await Setting.findOne({ where: { id } });
            
            if (!goalData) {
                return response.status(400).json({ message: 'Goal not found!' });
            }
            
            let parsedData = goalData.value ? JSON.parse(goalData.value) : null;
            
            if (!parsedData) {
                return response.status(400).json({ message: 'Invalid goal data format!' });
            }
            
            parsedData = { ...parsedData, goal: value };
            const goal = await Setting.update(
                { value: JSON.stringify(parsedData) }, 
                { where: { id } }
            );
            
            return response.status(201).json(goal);
        } 
        
        else {
            return response.status(405).json({ message: 'Method not allowed' });
        }
    } catch (error) {
        console.error("API error:", error);
        return response.status(500).json({ 
            message: "Server error", 
            error: error.message 
        });
    }
}