import moment from 'moment';

export const processBookingData = (booking) => {
    const qaList = [];
    if (booking?.Sections) {
      booking.Sections.sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0)).forEach(section => {
        if (section?.QaPairs?.length > 0) {
          section.QaPairs.sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0)).forEach(qa => {
            if (qa) {
              qaList.push({
                question:     qa.question || '',
                answer:       qa.answer ?? '',
                sectionOrder: section.order ?? 0,
                questionId:   qa.id ?? 0,
                questionType: qa.question_type || '',
              });
            }
          });
        }
      });
    }
    return qaList;
};

export const processBookingForExport = (booking) => {
    if (!booking) return {};

    const baseBookingData = {
        BOOKING:    booking.reference_id || '',
        GUEST:      booking.Guest
            ? `${booking.Guest.first_name || ''} ${booking.Guest.last_name || ''}`.trim()
            : '',
        BOOKING_TYPE: booking.type || '',
        CREATED:      booking.createdAt
            ? moment(booking.createdAt).format('DD-MM-YYYY')
            : '',
        STATUS:       processAnswer(booking.status),
        ELIGIBILITY:  processAnswer(booking.eligibility),
        ROOM:         booking.Rooms?.length
            ? booking.Rooms.map(r => r.label || '').join(', ')
            : '',
    };

    if (booking.Sections) {
        const allQaPairs = booking.Sections
            .filter(section => section && Array.isArray(section.QaPairs))
            .flatMap(section =>
                section.QaPairs.map(qa => ({ ...qa, sectionOrder: section.order ?? 0 }))
            )
            .sort((a, b) => {
                if (a.sectionOrder === b.sectionOrder) return (a.id ?? 0) - (b.id ?? 0);
                return (a.sectionOrder ?? 0) - (b.sectionOrder ?? 0);
            });

        allQaPairs.forEach(qa => {
            if (qa && qa.question && qa.id) {
                const key = `q_${qa.id}`;
                baseBookingData[key] = processAnswer(qa.answer, qa.question_type);
            }
        });
    }

    return baseBookingData;
};

// ─── Boolean question types ───────────────────────────────────────────────────
// These store answers as true/false, 1/0, "1"/"0", "true"/"false"
const BOOLEAN_QUESTION_TYPES = new Set(['simple-checkbox', 'equipment', 'boolean']);

const isBooleanLike = (val) => {
    if (typeof val === 'boolean') return true;
    if (typeof val === 'number') return val === 0 || val === 1;
    if (typeof val === 'string') {
        const t = val.trim().toLowerCase();
        return t === '0' || t === '1' || t === 'true' || t === 'false';
    }
    return false;
};

const booleanToYesNo = (val) => {
    if (val == null || val === '') return 'No';  // unanswered = unchecked
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    const t = typeof val === 'string' ? val.trim().toLowerCase() : String(val);
    return (t === '1' || t === 'true') ? 'Yes' : 'No';
};

// ─── Main answer processor ────────────────────────────────────────────────────

export const processAnswer = (answer, questionType = '') => {
    // 1. Boolean question types — must run BEFORE the null check.
    //    An unanswered boolean (null/undefined/'') means the box was not checked = "No".
    //    Handles: true/false, 1/0, "1"/"0", "true"/"false", null (unchecked)
    if (BOOLEAN_QUESTION_TYPES.has(questionType)) {
        if (answer == null || answer === '') return 'No';
        return booleanToYesNo(answer);
    }

    if (answer == null) return '';

    // 2. Bare numeric boolean — exactly 1 or 0 as a JS number, no question_type available.
    //    Strict equality prevents "10", "100" etc. being misread.
    if (answer === 1) return 'Yes';
    if (answer === 0) return 'No';

    let processedAnswer = answer;

    // 3. Date-range formatting
    if (questionType === 'date-range' && typeof answer === 'string') {
        try {
            const [startDate, endDate] = answer.split(' - ');
            if (startDate && endDate) {
                return `${moment(startDate).format('DD-MM-YYYY')} - ${moment(endDate).format('DD-MM-YYYY')}`;
            }
        } catch (e) {
            console.error('Error processing date range:', e);
            return answer;
        }
    }

    // 4. Try JSON-parsing stringified arrays/objects
    if (typeof answer === 'string' && answer.trim()) {
        try {
            if (answer.startsWith('[') || answer.startsWith('{')) {
                processedAnswer = JSON.parse(answer);
            }
        } catch (e) {
            return answer.trim();
        }
    }

    // 5. Arrays — join labels/values
    if (Array.isArray(processedAnswer)) {
        return processedAnswer
            .filter(Boolean)
            .map(item => {
                if (item == null) return '';
                if (typeof item === 'object') return item.label || item.name || '';
                return item.toString();
            })
            .filter(Boolean)
            .join(', ');
    }

    // 6. Plain objects — extract label/name
    if (typeof processedAnswer === 'object' && processedAnswer !== null) {
        if (processedAnswer.label) return processedAnswer.label;
        if (processedAnswer.name)  return processedAnswer.name;
        return Object.values(processedAnswer).filter(Boolean).join(', ');
    }

    // 7. Type-specific formatting
    switch (questionType) {
        case 'date':
            try {
                if (moment(processedAnswer).isValid()) {
                    return moment(processedAnswer).format('DD-MM-YYYY');
                }
                return processedAnswer.toString();
            } catch (e) {
                return processedAnswer.toString();
            }
        default:
            return processedAnswer.toString().trim();
    }
};