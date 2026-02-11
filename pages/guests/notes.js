import { useSelector } from "react-redux";
import dynamic from 'next/dynamic';
const SimpleTable = dynamic(() => import('../../components/ui/simpleTable'));
import { useEffect, useState } from "react";
import { Can } from "../../services/acl/can";

export default function NotesAndComments({ guest, comments }) {
    const user = useSelector((state) => state.user.user);
    const [commentsData, setCommentsData] = useState(comments || []);
    const [newComment, setNewComment] = useState({ title: "", message: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        setCommentsData(comments || []);
    }, [comments]);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const createComment = async () => {
        if (!newComment.title.trim() || !newComment.message.trim()) {
            showMessage('error', 'Please fill in both title and message');
            return;
        }

        setIsSubmitting(true);
        
        try {
            const response = await fetch(`/api/guests/comments/create`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...newComment,
                    guest_id: guest.id,
                    user_id: user.id,
                }),
            });

            const data = await response.json();
            
            console.log('API Response:', data); // Debug log

            // Check if response has an error flag (not the comment's message field)
            if (!response.ok || data.error) {
                showMessage('error', data.error || data.message || 'Failed to create comment');
                console.error('Error from API:', data);
            } else {
                // Add the new comment to the top of the list
                setCommentsData([data, ...commentsData]);
                setNewComment({ title: "", message: "" });
                showMessage('success', 'Comment added successfully!');
            }
        } catch (error) {
            console.error('Error creating comment:', error);
            showMessage('error', 'Failed to create comment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        createComment();
    }

    return (
        <div className="space-y-8">
            {/* Success/Error Message */}
            {message.text && (
                <div className={`p-4 rounded-md ${
                    message.type === 'success' 
                        ? 'bg-green-50 border border-green-200 text-green-800' 
                        : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                    <div className="flex">
                        <div className="flex-shrink-0">
                            {message.type === 'success' ? (
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium">{message.text}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Comments Table */}
            {commentsData && commentsData.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Previous Comments</h3>
                    <SimpleTable
                        columns={[
                            { label: "Date", attribute: "createdAt" },
                            { label: "Title", attribute: "title" },
                            { label: "Message", attribute: "message" },
                            { label: "Author", attribute: "User.first_name" },
                        ]}
                        data={commentsData}
                        styles={{ tbody: "text-sm" }}
                    />
                </div>
            )}

            {/* Add New Comment Form */}
            <Can I="Create/Edit" a="Guest">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Add Note or Comment</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                                Title
                            </label>
                            <input
                                id="title"
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Title"
                                value={newComment.title}
                                onChange={(e) => setNewComment({ ...newComment, title: e.target.value })}
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                                Message
                            </label>
                            <textarea
                                id="message"
                                rows="6"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                                placeholder="Write your message here"
                                value={newComment.message}
                                onChange={(e) => setNewComment({ ...newComment, message: e.target.value })}
                                required
                                disabled={isSubmitting}
                            />
                        </div>
                        
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="px-8 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isSubmitting || !newComment.title.trim() || !newComment.message.trim()}
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Submitting...
                                    </span>
                                ) : (
                                    'SUBMIT'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </Can>

            {/* Empty state */}
            {(!commentsData || commentsData.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                    <p>No comments yet. Add one above!</p>
                </div>
            )}
        </div>
    );
}