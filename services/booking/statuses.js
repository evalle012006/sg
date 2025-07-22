import { createContext } from "react";

export const fetchBookingStatuses = async () => {
    return await fetch('/api/settings/booking-statuses')
        .then(res => res.json())
}

export const fetchBookingEligibilities = async () => {
    return await fetch('/api/settings/booking-eligibilities')
        .then(res => res.json())
}

export const statusContext = createContext([]);
