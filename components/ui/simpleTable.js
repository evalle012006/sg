import _ from "lodash";
import ActionDropDown from "../booking-comp/action-dropdown";
import { useRouter } from "next/router";

export default function SimpleTable({ columns, data, options = { 
    hasDownloadLink: false, 
    hasViewOption: false, 
    hasEditOption: false, 
    hasDeleteOption: false,
    hasRenameOption: false,
    hasDownloadStayOption: false,
    hasSendEmailStayOption: false,
}, styles, actions = false }) {
    const router = useRouter();
    
    const downloadFile = async(link, name) => { 
        const element = document.createElement('a');
        element.setAttribute('href', link);
        element.setAttribute('download', name);
        element.setAttribute('target', '_blank');
        element.style.display = 'none';
        document.body.appendChild(element);
        element.dispatchEvent(new MouseEvent('click'));
        document.body.removeChild(element);
    }

    const returnAttribute = (obj, attributeString) => {
        let value = _.get(obj, attributeString);
        if (value instanceof Date) {
            return new Date(value).toLocaleDateString();
        }
        return value;
    }

    return (
        <table className="w-full">
            <thead className="">
                <tr className="">
                    {columns.map((column, index) => {
                        return (
                            <th key={index} className={`max-w-sm py-8 text-left bg-slate-400 font-bold text-neutral-700 ${index === 0 && 'rounded-tl-2xl pl-4'} ${actions != true && index === columns.length - 1 && 'rounded-tr-2xl'}`}>{column.label}</th>
                        )
                    })}
                    {actions && (<th className="py-8 text-left bg-slate-400 font-bold rounded-tr-2xl text-neutral-700">Action</th>)}
                </tr>
            </thead>
            <tbody className={`${styles && styles.tbody}`}>
                {data && data.map((row, rowIndex) => {
                    return (
                        <tr key={rowIndex} className="group/actions">
                            {columns.map((column, index) => <td key={index} className={`max-w-sm py-6 ${index == 0 && 'pl-4'} text-left ${rowIndex == data.length - 1 && index == 0 && 'rounded-bl-2xl'} ${actions != true && rowIndex == data.length - 1 && index == columns.length - 1 && 'rounded-br-2xl'} ${rowIndex % 2 && 'bg-zinc-100'}`}>{returnAttribute(row, column.attribute) || 'N/A'}</td>)}
                            {actions && <td className={`max-w-sm py-6 text-left ${rowIndex == data.length - 1 && 'rounded-br-2xl'} ${rowIndex % 2 && 'bg-zinc-100'}`}>
                                <ActionDropDown key={rowIndex} options={[
                                    {
                                        label: "View",
                                        action: () => {
                                          router.push(row.link);
                                        },
                                        hidden: !options.hasViewOption,
                                        icon: () => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 w-5 h-5">
                                                        <circle cx="12" cy="12" r="3.5" stroke="#222222"/>
                                                        <path d="M21 12C21 12 20 4 12 4C4 4 3 12 3 12" stroke="#222222"/>
                                                    </svg>
                                    },
                                    {
                                        label: "Edit",
                                        action: () => {
                                          router.push(row.link);
                                        },
                                        hidden: !options.hasEditOption,
                                        icon: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 w-5 h-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                    </svg>
                                    },
                                    {
                                        label: "Rename",
                                        action: () => {
                                            row.renameAction && row.renameAction();
                                        },
                                        hidden: !options.hasRenameOption,
                                        icon: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 w-5 h-5">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                                    </svg>
                                    },
                                    {
                                        label: "Download",
                                        action: () => {
                                            downloadFile(row.download_link, row.name);
                                        },
                                        hidden: !options.hasDownloadLink,
                                        icon: () => <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 w-5 h-5">
                                                        <path d="M8 22.0002H16C18.8284 22.0002 20.2426 22.0002 21.1213 21.1215C22 20.2429 22 18.8286 22 16.0002V15.0002C22 12.1718 22 10.7576 21.1213 9.8789C20.3529 9.11051 19.175 9.01406 17 9.00195M7 9.00195C4.82497 9.01406 3.64706 9.11051 2.87868 9.87889C2 10.7576 2 12.1718 2 15.0002L2 16.0002C2 18.8286 2 20.2429 2.87868 21.1215C3.17848 21.4213 3.54062 21.6188 4 21.749" stroke="#1C274C" strokeWidth="1.5" strokeLinecap="round"/>
                                                        <path d="M12 2L12 15M12 15L9 11.5M12 15L15 11.5" stroke="#1C274C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                    },
                                    {
                                        label: "Delete",
                                        action: () => {
                                            row.deleteAction && row.deleteAction(row.name, row.file_path);
                                        },
                                        hidden: !options.hasDeleteOption,
                                        icon: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 w-5 h-5 text-red-400">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                                    </svg>
                                    },
                                    {
                                        label: "Download Summary of Stay",
                                        action: () => {
                                          row.downloadSummaryAction && row.downloadSummaryAction(row.uuid);
                                        },
                                        hidden: !row.allowDownloadEmail,
                                        icon: () => <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                        
                                      },
                                      {
                                        label: "Send Summary of Stay via Email",
                                        action: () => {
                                          row.emailSummaryAction && row.emailSummaryAction(row.uuid);
                                        },
                                        hidden: !row.allowDownloadEmail,
                                        icon: () => <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                        
                                      },
                                ]} />
                            </td>}
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}