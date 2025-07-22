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
            <div className={`my-4 ${className || ''}`}>
                {description && <div className='rich-text-container'>
                    {parse(description)}
                </div>}
            </div>}
    </>);
}