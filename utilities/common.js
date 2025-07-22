import moment from 'moment';


export const getFirstLetters = (str, delimiter = '-') => {
    if (str) {
        // Split the string into words
        const words = str.split(delimiter);

        // Initialize an empty string to store the first letters
        let firstLetters = "";

        // Iterate through each word
        words.forEach(word => {
        // Extract the first letter of each word and concatenate it to the result
            firstLetters += word.charAt(0);
        });

        // Return the concatenated first letters
        return firstLetters.toUpperCase();
    }

    return str;
  }

export const omitAttribute = (obj, ...props) => {
    const result = { ...obj };
    props.forEach(prop => {
        delete result[prop];
    });
    return result;
}

export const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const UppercaseFirstLetter = (str) => {
    if (!str) {
        return;
    }
    const arr = str.split(" ");

    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);

    }

    return arr ? arr.join(" ") : '';
}

export const validateDate = (value) => {
    let error;

    const date = moment(value);

    if (!date.isValid()) {
        error = 'Invalid date entered';
    }

    return error;
}

export const generateMonthsArray = () => {
    const currentDate = new Date();
    const monthsArray = [];

    for (let i = 0; i <= 12; i++) {
        let year = currentDate.getFullYear();
        let month = currentDate.getMonth() - i;

        if (month < 0) {
            year -= 1;
            month += 12;
        }

        monthsArray.unshift(new Date(year, month, 1));
    }

    return monthsArray;
}

export const checkFileSize = (size, limitInBytes = 5120000) => {
    let msg;
    const fileSizeMb = formatBytes(size, 0);
    const limitInMb = formatBytes(limitInBytes, 0);
    if (size > limitInBytes) {
        msg = `The file is too large. Please select a file smaller than ${limitInMb}.`;
    }

    return msg;
}

export const serializePackage = (packageType) => {
  if (!packageType) return '';
  if (packageType.includes("Wellness & Very High Support Package")) {
    return "WVHS";
  } else if (packageType.includes("Wellness & High Support Package")) {
    return "WHS";
  } else if (packageType.includes("Wellness & Support") || packageType.includes("Wellness and Support")) {
    return "WS";
  } else if (packageType.includes("NDIS Support Package - No 1:1 assistance with self-care")) {
    return "SP"
  } else if (packageType.includes("NDIS Care Support Package - includes up to 6 hours of 1:1 assistance with self-care")) {
    return "CSP"
  } else if (packageType.includes("NDIS High Care Support Package - includes up to 12 hours of 1:1 assistance with self-care")) {
    return "HCSP"
  } else {
    return '';
  }
}

export const getFunder = (sections) => {
  if (sections && sections.length == 0) return;
  let funder = null;
  sections.map(section => {
    if (section.QaPairs.length > 0) {
      const funderQaPair = section.QaPairs.find(qaPair => qaPair.question == 'How will your stay be funded?');
      if (funderQaPair) {
        funder = funderQaPair.answer;
      }
    } else if (section?.Questions?.length > 0) {
      const funderQuestion = section.Questions.find(question => question.question == 'How will your stay be funded?');
      if (funderQuestion && funderQuestion.fromQa) {
        funder = funderQuestion.answer;
      }

    }
  });

  return funder;
}

export const getCheckInOutAnswer = (qaPairs = []) => {
  if (qaPairs.length > 0) {
    const checkInAnswer = qaPairs.find(qa => qa.question == 'Check In Date')?.answer;
    const checkOutAnswer = qaPairs.find(qa => qa.question == 'Check Out Date')?.answer;
    if (checkInAnswer && checkOutAnswer) {
        return [ checkInAnswer, checkOutAnswer ];
    }
  }

  return null;
}

export const validatePhoneNumber = (val) => {
    const validPhoneNumber = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{2,4})$/;
    return val.match(validPhoneNumber);
}

export const validateEmail = (val) => {
      const validEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      return val.match(validEmail);
  }