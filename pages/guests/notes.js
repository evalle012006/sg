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
        const response = await fetch(`/api/guests/comments/create`, {
            method: "POST",
            body: JSON.stringify({
                ...newComment,
                guest_id: guest.id,
                user_id: user.id,
            }),
        });

        const data = await response.json();

        if (data.error) {
            console.log(data.error);
        }

        setCommentsData([...commentsData, data]);
        setNewComment({ title: "", message: "" });
    }

    return (
        <>
            <div className="mt-10">
                <SimpleTable
                    columns={[
                        { label: "Date", attribute: "createdAt" },
                        { label: "Title", attribute: "title" },
                        { label: "Message", attribute: "message" },
                        { label: "Author", attribute: "User.first_name" },
                    ]}
                    data={commentsData}
                    styles={{ tbody: "text-sm" }}
                // hasDownloadLink={true}
                />
            </div>

            <Can I="Create/Edit" a="Guest">
                <div className="mt-10">
                    <h3 className="font-bold">Add Notes or Comments</h3>
                    {/* TODO - UPDATE FORM */}
                    <form className="">
                        <input
                            type="text"
                            className="focus:outline-none mt-6 w-full p-4 bg-zinc-100 rounded-2xl"
                            placeholder="Title"
                            value={newComment.title}
                            onChange={(e) => setNewComment({ ...newComment, title: e.target.value })}
                        ></input>
                        <textarea
                            rows="6"
                            className="focus:outline-none mt-6 w-full p-4 bg-zinc-100 rounded-2xl"
                            placeholder="Message"
                            value={newComment.message}
                            onChange={(e) => setNewComment({ ...newComment, message: e.target.value })}
                        ></textarea>
                        <div
                            onClick={() => createComment()}
                            className="float-right mt-8 max-w-fit py-3 px-16 bg-emerald-500 text-white rounded-xl cursor-pointer">
                            Submit
                        </div>
                    </form>
                </div>
            </Can>
        </>
    );
}