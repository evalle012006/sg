import Image from "next/image"
import _ from "lodash";
import { useMemo, useState } from "react";
import Modal from "./../../../components/ui/modal";
import { fetchTemplate } from "../../../store/templateSlice";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";

export default function ConditionsTable({ columns, data, styles, actions }) {

    const dispatch = useDispatch();
    const [selectedCondition, setSelectedCondition] = useState(null);
    const [removeConditionModal, setRemoveConditionModal] = useState(false);

    const returnAttribute = (obj, attributeString) => {
        let value = _.get(obj, attributeString);
        if (value instanceof Date) {
            return new Date(value).toLocaleDateString();
        }
        return value;
    }

    const hasConditions = useMemo(() => data.filter(row => row.metaData != null).length > 0)

    const deleteCondition = async () => {
        await fetch(`/api/booking-templates/questions/dependencies/${selectedCondition.metaData.id}`, {
            method: "DELETE",
        }).then((res) => {
            if (res.status === 200) {
                dispatch(fetchTemplate());

                toast("Condition deleted sucessfully.", { type: 'success' });
            }
            else toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        });

        console.log(selectedCondition);
    }

    return (<>
        <table className="w-full">
            <thead className="">
                <tr className="">
                    {columns.map((column, index) => {
                        return (
                            <th key={index} className={`max-w-sm py-8 text-left bg-slate-400 font-bold text-neutral-700 ${index === 0 && 'rounded-tl-2xl pl-4'} ${!hasConditions && index === columns.length - 1 && 'rounded-tr-2xl'}`}>{column.label}</th>
                        )
                    })}
                    {hasConditions && (<th className="py-8 text-left bg-slate-400 font-bold rounded-tr-2xl text-neutral-700">Actions</th>)}
                </tr>
            </thead>
            <tbody className={`${styles && styles.tbody}`}>
                {data.map((row, rowIndex) => {
                    return (
                        <tr key={rowIndex} className="group/actions">
                            {columns.map((column, index) => <td key={index} className={`max-w-sm py-6 ${index == 0 && 'pl-4'} text-left ${rowIndex == data.length - 1 && index == 0 && 'rounded-bl-2xl'} ${!hasConditions && rowIndex == data.length - 1 && index == columns.length - 1 && 'rounded-br-2xl'} ${rowIndex % 2 && 'bg-zinc-100'}`}>{returnAttribute(row, column.attribute) || 'N/A'}</td>)}
                            <td className={`max-w-sm py-6 text-left ${rowIndex == data.length - 1 && 'rounded-br-2xl'} ${rowIndex % 2 && 'bg-zinc-100'}`}>
                                {data[rowIndex].metaData != null && <button title="remove" className="mr-4" onClick={() => {
                                    setSelectedCondition(data[rowIndex]);
                                    setRemoveConditionModal(true)
                                }}>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth="1.5"
                                        stroke="currentColor"
                                        className="w-5 h-5"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                        />
                                    </svg>
                                </button>}
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
        {removeConditionModal && <Modal title="Delete selected condition?"
            description={`Selected condition for anwer '${selectedCondition.answer}' will be permanently removed.`}
            onClose={() => setRemoveConditionModal(false)}
            onConfirm={() => {
                setRemoveConditionModal(false)
                deleteCondition();
            }} />}
    </>
    )
}