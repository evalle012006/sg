import moment from 'moment';

export const processBookingData = (booking) => {
    const qaList = [];
    if (booking?.Sections) {
      booking.Sections.sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0)).forEach(section => {
        if (section?.QaPairs?.length > 0) {
          section.QaPairs.sort((a, b) => (a?.id ?? 0) - (b?.id ?? 0)).forEach(qa => {
            if (qa) {
              qaList.push({
                question: qa.question || '',
                answer: qa.answer ?? '',
                sectionOrder: section.order ?? 0,
                questionId: qa.id ?? 0
              });
            }
          });
        }
      });
    }
    return qaList;
  };
  
  export const processBookingForExport = (booking) => {
    if (!booking) {
      return {};
    }
  
    const baseBookingData = {
      BOOKING: booking.reference_id || '',
      GUEST: booking.Guest ? 
        `${booking.Guest.first_name || ''} ${booking.Guest.last_name || ''}`.trim() : '',
      BOOKING_TYPE: booking.type || '',
      CREATED: booking.createdAt ? 
        moment(booking.createdAt).format('DD-MM-YYYY') : '',
      STATUS: processAnswer(booking.status),
      ELIGIBILITY: processAnswer(booking.eligibility),
      ROOM: booking.Rooms?.length ? 
        booking.Rooms.map(r => r.label || '').join(', ') : ''
    };
  
    if (booking.Sections) {
      const allQaPairs = booking.Sections
        .filter(section => section && Array.isArray(section.QaPairs))
        .flatMap(section => {
          return section.QaPairs.map(qa => ({
            ...qa,
            sectionOrder: section.order ?? 0
          }));
        })
        .sort((a, b) => {
          if (a.sectionOrder === b.sectionOrder) {
            return (a.id ?? 0) - (b.id ?? 0);
          }
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

export const processAnswer = (answer, questionType = '') => {
    if (answer == null) {
        return '';
    }

    let processedAnswer = answer;

    if (questionType === 'date-range' && typeof answer === 'string') {
        try {
            const [startDate, endDate] = answer.split(' - ');
            if (startDate && endDate) {
                const formattedStartDate = moment(startDate).format('DD-MM-YYYY');
                const formattedEndDate = moment(endDate).format('DD-MM-YYYY');
                return `${formattedStartDate} - ${formattedEndDate}`;
            }
        } catch (e) {
            console.error('Error processing date range:', e);
            return answer;
        }
    }

    if (typeof answer === 'string' && answer.trim()) {
        try {
            if (answer.startsWith('[') || answer.startsWith('{')) {
                processedAnswer = JSON.parse(answer);
            }
        } catch (e) {
            return answer.trim();
        }
    }

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

    if (typeof processedAnswer === 'object' && processedAnswer !== null) {
        if (processedAnswer.label) return processedAnswer.label;
        if (processedAnswer.name) return processedAnswer.name;
        
        return Object.values(processedAnswer)
            .filter(Boolean)
            .join(', ');
    }

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