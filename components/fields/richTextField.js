import { useMemo, useState } from 'react';

import { EditorState, ContentState, convertFromHTML } from 'draft-js';
import parse from 'html-react-parser';
import { convertToHTML } from 'draft-convert';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';

import dynamic from 'next/dynamic';
const Editor = dynamic(
    () => import('react-draft-wysiwyg').then((mod) => mod.Editor),
    { ssr: false }
);

export default function RichTextField({ builderMode, description, onChange, className, error }) {
    const [editorState, setEditorState] = useState(
        description ?
            EditorState.createWithContent(
                ContentState.createFromBlockArray(
                    convertFromHTML(description)
                )) :
            EditorState.createEmpty()
    );

    const convertedContent = useMemo(() => {
        return convertToHTML(editorState.getCurrentContent());
    });

    const getEditorClasses = () => {
        const baseClasses = "bg-white px-4";
        if (error) {
            return `${baseClasses} border-2 border-red-400 bg-red-50 rounded-lg`;
        }
        return baseClasses;
    };


    return (<>
        {builderMode ?
            <>
                <div className={`bg-white px-4 ${className || ''}`}>
                    <Editor
                        editorState={editorState}
                        onEditorStateChange={setEditorState}
                        wrapperClassName={className || ''}
                        toolbar={{
                            options: ['inline', 'blockType', 'fontSize', 'list', 'textAlign', 'history'],
                            inline: { inDropdown: false },
                            blockType: {
                                inDropdown: false,
                                options: ['Normal', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'],
                            },
                            list: { inDropdown: false },
                            textAlign: { inDropdown: false },
                            history: { inDropdown: false },
                        }}
                    />
                    {convertedContent != description &&
                        <button className='bg-sky-800 px-4 py-2 rounded text-white ml-2 float-right' onClick={() => onChange({ description: convertedContent })}>
                            Save
                        </button>}
                </div>
            </>
            :
            <div className={`my-4 ${getEditorClasses()} ${className || ''}`}>
                {description && <div className='rich-text-container'>
                    {parse(description)}
                </div>}
                {error && (
                    <div className="mt-1.5 flex items-center">
                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-red-600 text-sm font-medium">{error}</p>
                    </div>
                )}
            </div>}
    </>);
}