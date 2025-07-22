import { useEffect, useState } from "react";

export default function BookingStatus(props) {
    const [statusColor, setStatusColor] = useState(null);
    const [status, setStatus] = useState();

    useEffect(() => {
        switch (props.status.color) {
            case "green":
                setStatusColor("bg-emerald-400");
                break;
            case "lime":
                setStatusColor("bg-lime-500");
                break;
            case "yellow":
                setStatusColor("bg-yellow-400");
                break;
            case "red":
                setStatusColor("bg-red-400");
                break;
            case "gray":
                setStatusColor("bg-zinc-400");
                break;
            case "orange":
                setStatusColor("bg-orange-400");
                break;
            default:
                setStatusColor("bg-sky-800");
                break;
        }

        let label = props.status.label;

        if (props.guestView) {
            switch (props.status.name) {
                case "booking_cancelled":
                    label = 'Cancelled';
                    break;
                default:
                    break;
            }
        }

        setStatus(label);
    }, [props]);

    return (<div className={`mx-0 md:mx-4 md:mr-0 max-h-8 flex items-center text-white text-sm rounded-full p-1 px-3 w-fit
                            ${status && (status.length > 14 && status.length <= 17) && 'w-[11rem]'} 
                            ${status && status.length > 17 && 'w-[13rem]'} 
                            ${statusColor}`}>
        <div className="relative inline-flex rounded-full h-3 w-3 mr-2 bg-white"></div>
        <p className="whitespace-nowrap">{status}</p>
    </div>)
}