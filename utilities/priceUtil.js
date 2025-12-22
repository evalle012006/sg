
export const formatAUD = (value) => {
    if (value === null || value === undefined || isNaN(value)) return null;
    const formatted = new Intl.NumberFormat('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
    return `AUD ${formatted}`;
};