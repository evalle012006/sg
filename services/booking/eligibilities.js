import { createContext } from "react";

export const fetchBookingEligibilities = async () => {
    return await fetch('/api/settings/booking-eligibilities')
        .then(res => res.json())
}

export const eligibilityContext = createContext([]);
