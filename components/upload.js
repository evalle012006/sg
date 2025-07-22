import { useEffect, useRef, useState } from "react";
import { toast } from 'react-toastify';
import { checkFileSize } from "../utilities/common";

export default function UploadFile(props) {
    const [file, setFile] = useState();
    const [bucketType, setBucketType] = useState(props.bucketType || 'restricted');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleUpload = async () => {
        if (file) {
            const fileSizeMsg = checkFileSize(file.size, 5120000);
            if (fileSizeMsg) {
                toast.error(fileSizeMsg, 10240);
            } else {
                setUploading(true);
                const formData = new FormData();
                formData.append("file", file);
                formData.append("fileType", props.fileType);
                formData.append("metadata", JSON.stringify(props.metadata));

                const response = await fetch("/api/storage/upload", {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    props.onUpload();
                    toast(data.message, { type: 'success' });
                } else {
                    toast(data.message, { type: 'error' });
                }
                setFile(null);
                fileInputRef.current.value = null;
                setUploading(false);
            }
        }
    };

    useEffect(() => {
        if (file) {
            handleUpload();
        }
    }, [file]);

    return (
        <div className="flex justify-center items-center mt-4 w-full bg-zinc-100 rounded-lg p-10 text-center border-dashed border-2 border-zinc-300" onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation()
            setFile(e.dataTransfer.files[0]);
            e.target.classList.remove('border-zinc-500');
        }}

            onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.target.classList.add('border-zinc-500');
            }}

            onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.target.classList.remove('border-zinc-500');
            }}

            onClick={() => {
                fileInputRef.current.click();
            }}
        >
            {uploading && <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>}
            {!uploading && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>}
            <p className="ml-2 text-zinc-500">Drag and drop or browse files</p>
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                setFile(e.target.files[0]);
            }} />
        </div>
    )
}