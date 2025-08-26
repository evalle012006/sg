import { useSelector } from "react-redux";
import dynamic from 'next/dynamic';
const SimpleTable = dynamic(() => import('../../components/ui/simpleTable'));
import { useEffect, useState } from "react";
import { Can } from "../../services/acl/can";

export default function NotesAndComments({ guest, comments }) {
    const user = useSelector((state) => state.user.user);
    const [commentsData, setCommentsData] = useState(comments);
    const [newComment, setNewComment] = useState({ title: "", message: "" });

    useEffect(() => {
        setCommentsData(comments);
    }, [comments]);

    const createComment = async () => {
        if (!newComment.title.trim() || !newComment.message.trim()) {
            return;
        }

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
            console.log(data.error);
        } else {
            setCommentsData([...commentsData, data]);
            setNewComment({ title: "", message: "" });
        }
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        createComment();
    }

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

            {/* Add New Comment Form */}
            <Can I="Create/Edit" a="Guest">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Notes & Comments</h2>
                    
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
                                rows="6"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                                placeholder="Write your message here"
                                value={newComment.message}
                                onChange={(e) => setNewComment({ ...newComment, message: e.target.value })}
                                required
                            />
                        </div>
                        
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="px-8 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!newComment.title.trim() || !newComment.message.trim()}
                            >
                                SUBMIT
                            </button>
                        </div>
                    </form>
                </div>
            </Can>
        </div>
    );
}