import { useSelector } from "react-redux";
import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";

const SimpleTable = dynamic(() => import('../../components/ui/simpleTable'));

export default function GuestNotesAndComments({ guest, comments }) {
    const user = useSelector((state) => state.user.user);
    const [commentsData, setCommentsData] = useState(comments || []);
    const [newComment, setNewComment] = useState({ title: "", message: "" });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setCommentsData(comments || []);
    }, [comments]);

    const createComment = async () => {
        if (!newComment.title.trim() || !newComment.message.trim()) {
            return;
        }

        if (!guest?.id || !user?.id) {
            console.error('Missing guest or user ID');
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

            if (data.error) {
                console.error(data.error);
            } else {
                setCommentsData([...commentsData, data]);
                setNewComment({ title: "", message: "" });
            }
        } catch (error) {
            console.error('Error creating comment:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        createComment();
    };

    return (
        <div className="space-y-8">
            {/* Existing Comments Table */}
            {commentsData && commentsData.length > 0 && (
                <div>
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

            {/* Add New Comment Form - Available for guests */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Add a Note or Comment</h2>
                
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
                        />
                    </div>
                    
                    <div>
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                            Message
                        </label>
                        <textarea
                            id="message"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter your message here..."
                            rows={4}
                            value={newComment.message}
                            onChange={(e) => setNewComment({ ...newComment, message: e.target.value })}
                            required
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isSubmitting || !newComment.title.trim() || !newComment.message.trim()}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSubmitting ? 'Submitting...' : 'Add Comment'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Empty state when no comments */}
            {(!commentsData || commentsData.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                    <p>No notes or comments yet. Add one above!</p>
                </div>
            )}
        </div>
    );
}