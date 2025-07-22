import React, { useEffect, useImperativeHandle, useState } from "react";
import Image from "next/image";
import moment from "moment";

import dynamic from 'next/dynamic';
import { useDispatch, useSelector } from 'react-redux';
import { globalActions } from "../../store/globalSlice";
import { QUESTION_KEYS } from "./../../services/booking/question-helper";

const Box = dynamic(() => import('./box'));
const BookingEditView = dynamic(() => import('./booking-edit-view'));
const AssetsAndEquipment = dynamic(() => import('./assets-and-equipment'));

function BookingDetailComp({ booking }, ref) {
  const user = useSelector(state => state.user.user);
  const [packageAnswer, setPackageAnswser] = useState();
  const [equipments, setEquipments] = useState([]);

  useEffect(() => {
    const updateHealthInfo = async (answer) => {
      const answers = answer;
      let updatedHealthInfo = [...healthInfo];
      let prevAnswers = [];
      const response = await fetch('/api/bookings/history/health-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uuid: booking.Guest.uuid })
      });

      if (response.status == 200) {
        prevAnswers = await response.json();
      }

      healthInfo.forEach((item, index) => {
        if (answers && answers.includes(item.diagnose)) {
          updatedHealthInfo[index].answer = true;
        }
        if (prevAnswers && prevAnswers?.info?.includes(item.diagnose)) {
          updatedHealthInfo[index].prev_answer = true;
        }
      })

      setHealthInfo(updatedHealthInfo);
    }

    let sortedSectionsList = {};

    if (booking.Equipment.length > 0) {
      const equipments = booking.Equipment?.map(equipment => {
        const eq = `${equipment.name} - ${equipment.serial_number ? equipment.serial_number : 'N/A'}`;
        return eq;
      });
      setEquipments(equipments);
    }

    // Get all Q&A pairs for easier lookup
    const allQaPairs = booking.Sections.map(section => section.QaPairs).flat();

    booking.Sections.sort((a, b) => a.order - b.order)
      .map(section => {
        if (section.QaPairs.length > 0) {
          const pageTitle = section.QaPairs[0].Question.Section.Page.title;
          const pageId = section.QaPairs[0].Question.Section.Page.id;

          if (pageTitle && sortedSectionsList.hasOwnProperty(pageTitle)) {
            sortedSectionsList[pageTitle].push({ pageId, section });
          } else {
            sortedSectionsList[pageTitle] = [{ pageId, section }];
          }
        }

        section.QaPairs.map(question => {
          // Course selection using question key
          if (question.question_key === QUESTION_KEYS.COURSE_SELECTION) {
            setCourse(question.answer)
          }
          
          // Package selection using question keys
          if (question.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES ||
              question.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) {
            // making sure answer is not overwritten with null
            if (question.answer) {
              setBookingPackage(question.answer)
            }
          }

          // Health conditions using question key
          if (question.question_key === QUESTION_KEYS.HEALTH_CONDITIONS) {
            updateHealthInfo(question.answer)
            setHealthInfoLastUpdate(question.updatedAt)
          }

          // Check-in/out dates using question keys
          const checkinoutDates = [];
          if (question.question_key === QUESTION_KEYS.CHECK_IN_OUT_DATE) {
            const dates = question.answer.split(' - ')
            if (dates && dates.length == 2) {
              setCheckInCheckOutDate(dates)
            }
          } else if (question.question_key === QUESTION_KEYS.CHECK_IN_DATE) {
            checkinoutDates.push(question.answer)
          } else if (question.question_key === QUESTION_KEYS.CHECK_OUT_DATE) {
            checkinoutDates.push(question.answer)
          }

          if (checkinoutDates.length == 2) {
            setCheckInCheckOutDate(checkinoutDates)
          }

          // Funding source using question key
          if (question.question_key === QUESTION_KEYS.FUNDING_SOURCE) {
            setBookingFunder(question.answer);
          }

          // Package answer (duplicate handling for different package questions)
          if (question.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL ||
              question.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES) {
            setPackageAnswser(question.answer);
          }
        })
      });

    // Sort the keys based on page.id
    sortedSectionsList = Object.entries(sortedSectionsList)
      .sort((a, b) => a[1][0].pageId - b[1][0].pageId)
      .reduce((obj, [key, value]) => {
        obj[key] = value.map(({ section }) => section);
        return obj;
      }, {});

    setSortedSections(sortedSectionsList);
    setAmendments(booking.Logs);
  }, [booking.Logs, booking.Sections, booking.Guest.id, healthInfo]);

  useEffect(() => {
    if (packageAnswer) {
      const serializePackage = (packageType) => {
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

      if (!course) {
        setPackageType(serializePackage(packageAnswer));
      } else if (course) {
        setPackageType('Course' + serializePackage(packageAnswer));
      } else {
        setPackageType('N/A');
      }
    }
  }, [packageAnswer, course]);

  const [checkInCheckOutDate, setCheckInCheckOutDate] = useState('');
  const [course, setCourse] = useState();
  const [bookingPackage, setBookingPackage] = useState();
  const [totalGuests, setTotalGuests] = useState(0);
  const [healthInfoLastUpdate, setHealthInfoLastUpdate] = useState();
  const [healthInfo, setHealthInfo] = useState([
    {
      diagnose: "Medications recently changed",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Low blood pressure",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Autonomic Dysreflexia",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Current Pressure Injuries",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Current open wounds, cuts, abrasions or stitches",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Osteoperosis/Osteopenia",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Low bone density",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Admission to hospital in the last 3 months",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Fracture/s in the last 12 months",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Head/Brain injury or memory loss",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Respiratory complications",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Moderate to severe spasm/spasticity",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Diabetes",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "Been advised by your doctor not to participate in particular actvities",
      answer: false,
      prev_answer: false
    },
    {
      diagnose: "I currently require subcutaneous injections",
      answer: false,
      prev_answer: false
    }
  ]);
  const [editBooking, setEditBooking] = useState();
  const [amendments, setAmendments] = useState([]);
  const [bookingFunder, setBookingFunder] = useState();
  const [packageType, setPackageType] = useState();

  const [sortedSections, setSortedSections] = useState({});

  const currentUser = useSelector(state => state.user.user);
  const globalLoading = useSelector(state => state.global.loading);
  const dispatch = useDispatch();

  const isJsonString = (str) => {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  }

  const getNumberOfColumns = (type) => {
    let columnsLength = 1;
    if (type === "2_columns") {
      columnsLength = 2;
    } else if (type === "3_columns") {
      columnsLength = 3;
    } else if (type === "4_columns") {
      columnsLength = 4;
    }
    return columnsLength;
  }

  const getFileUrl = async (fileName, fileType) => {
    const response = await fetch('/api/storage/upload?' + new URLSearchParams({ filename: fileName, filepath: fileType }));
    const data = await response.json();

    let url = '';
    if (response.ok) {
      url = data.fileUrl;
    }

    return url;
  }

  const getCheckInCheckOutDate = (dateType) => {
    if (dateType === 'checkIn') {
      if (checkInCheckOutDate && checkInCheckOutDate.length > 0) {
        return checkInCheckOutDate && moment(checkInCheckOutDate[0]).format("DD/MM/YYYY");
      }
      if (booking.preferred_arrival_date) {
        return <p> <span className="text-xs">preferred</span> {moment(booking.preferred_arrival_date).format("DD/MM/YYYY")}</p>;
      }

    } else if (dateType === 'checkOut') {
      if (checkInCheckOutDate && checkInCheckOutDate.length > 0) {
        return checkInCheckOutDate && moment(checkInCheckOutDate[1]).format("DD/MM/YYYY");
      }

      if (booking.preferred_departure_date) {
        return <p><span className="text-xs">preferred</span> {moment(booking.preferred_departure_date).format("DD/MM/YYYY")}</p>;
      }

    }

    return null;
  }

  useImperativeHandle(ref, () => {
    return {
      enableBookingEditMode() {
        setEditBooking(true);
      }
    }
  });

  const handleApproveDeclineAmendment = (amendment, approval) => async () => {
    dispatch(globalActions.setLoading(true));
    const currentUsername = currentUser.first_name + ' ' + currentUser.last_name;

    let approvedDeclineAmendments = { approved: approval, approved_by: currentUsername, approval_date: new Date() };
    if (!approval) {
      approvedDeclineAmendments = { approved: approval, approved_by: null, approval_date: null, declined_by: currentUsername, decline_date: new Date() };
    }

    const response = await fetch('/api/bookings/amendment-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: amendment.id, ...approvedDeclineAmendments })
    });

    if (response.status == 200) {
      const updatedAmendments = amendments.map(item => {
        if (item.id === amendment.id) {
          return { ...item, data: { ...item.data, ...approvedDeclineAmendments } }
        }
        return item;
      });

      setAmendments(updatedAmendments);
      dispatch(globalActions.setLoading(false));
    }
  }

  const getTotalGuests = (room) => {
    let totalGuests = 0;
    totalGuests += room.adults;
    totalGuests += room.children;
    totalGuests += room.infants;
    totalGuests += room.pets;
    return totalGuests;
  }

  const parseAnswer = (answer, questionType) => {
    // Early return for empty/null values
    if (!answer) return '';
    
    try {
      // Handle date types
      if (questionType === 'date') {
        return moment(answer).format('DD/MM/YYYY');
      }
      
      if (questionType === 'date-range') {
        const answerArr = answer.split(' - ');
        return moment(answerArr[0]).format('DD/MM/YYYY') + ' - ' + moment(answerArr[1]).format('DD/MM/YYYY');
      }
      
      // Handle care-table with grouped date format
      if (questionType === 'care-table') {
        return formatCareTableData(answer);
      }
      
      // Handle goal-table with detailed format
      if (questionType === 'goal-table') {
        return formatGoalTableData(answer);
      }
      
      // Handle rooms
      if (questionType === 'rooms') {
        if (Array.isArray(answer)) {
          return answer.map(room => room?.name || 'Unnamed room').join(', ');
        }
        
        if (typeof answer === 'string') {
          try {
            const parsed = JSON.parse(answer);
            if (Array.isArray(parsed)) {
              return parsed.map(room => room?.name || 'Unnamed room').join(', ');
            }
          } catch (e) {
            // Continue if parsing fails
          }
        }
      }
      
      // Handle checkbox
      if (questionType === 'checkbox') {
        if (Array.isArray(answer)) {
          return answer.map(item => String(item)).join(', ');
        }
        
        if (typeof answer === 'string') {
          try {
            const parsed = JSON.parse(answer);
            if (Array.isArray(parsed)) {
              return parsed.map(item => String(item)).join(', ');
            }
          } catch (e) {
            // Continue if parsing fails
          }
        }
      }
      
      // If answer is an object but not handled by specific types above
      if (typeof answer === 'object') {
        try {
          return JSON.stringify(answer);
        } catch (e) {
          return 'Complex object';
        }
      }
      
      // Finally, for any other cases just convert to string
      return String(answer);
      
    } catch (e) {
      console.error('Parse error:', e);
      return String(answer || '');
    }
  };

  // Enhanced function for care-table formatting
  const formatCareTableData = (answer) => {
    // Handle different input types
    let data = answer;
    
    try {
      // If the answer is a string, try to parse it as JSON
      if (typeof answer === 'string') {
        data = JSON.parse(answer);
      }
      
      // Make sure we're working with an array
      if (!Array.isArray(data)) {
        return "Invalid care data format";
      }
      
      // Group care items by date
      const dateGroups = {};
      data.forEach(item => {
        if (!item.date) return;
        
        if (!dateGroups[item.date]) {
          dateGroups[item.date] = {
            morning: null,
            afternoon: null,
            evening: null
          };
        }
        
        if (item.care && dateGroups[item.date].hasOwnProperty(item.care)) {
          dateGroups[item.date][item.care] = item.values;
        }
      });
      
      // Return structured data instead of a string
      return {
        formatted: true,
        dates: Object.entries(dateGroups).map(([date, periods]) => ({
          date,
          periods: {
            morning: periods.morning,
            afternoon: periods.afternoon,
            evening: periods.evening
          }
        }))
      };
    } catch (e) {
      console.error("Error formatting care table data:", e);
      return "Error formatting care data";
    }
  };

  // Enhanced function for goal-table formatting with more details when available
  // Enhanced function for goal-table formatting that preserves all columns
  const formatGoalTableData = (answer) => {
    // Handle different input types
    let data = answer;
    
    try {
      // If the answer is a string, try to parse it as JSON
      if (typeof answer === 'string') {
        data = JSON.parse(answer);
      }
      
      // Make sure we're working with an array
      if (!Array.isArray(data)) {
        return "Invalid goal data format";
      }
      
      // Return the parsed goals data directly with a formatted flag
      // This preserves all columns for the table display
      return {
        formatted: true,
        goals: data
      };
      
    } catch (e) {
      console.error("Error formatting goal table data:", e);
      return "Error formatting goal data";
    }
  };

  const parseCareDiff = (oldData, newData) => {
    if (!oldData || !newData) return { oldFormatted: '', newFormatted: '', detailedChanges: [] };
    
    try {
      // Convert to arrays if needed
      const oldArray = Array.isArray(oldData) ? oldData : JSON.parse(oldData);
      const newArray = Array.isArray(newData) ? newData : JSON.parse(newData);
      
      // Track both specific changes and full data for comparison
      const changesMap = {};
      const detailedChanges = [];
      
      // Helper to create a unique key for each care period
      const createKey = (item) => `${item.date}-${item.care}`;
      
      // Helper to compare two care value objects and store the differences
      const compareValues = (oldValues, newValues) => {
        if (!oldValues || !newValues) return true; // Consider different if one is missing
        
        const changed = 
          oldValues.time !== newValues.time ||
          oldValues.duration !== newValues.duration ||
          oldValues.carers !== newValues.carers;
          
        return changed;
      };
      
      // Index old items by key for quick lookup
      const oldItemsMap = {};
      oldArray.forEach(item => {
        const key = createKey(item);
        oldItemsMap[key] = { ...item, processed: false };
      });
      
      // Find added or modified items
      newArray.forEach(item => {
        const key = createKey(item);
        const oldItem = oldItemsMap[key];
        
        if (!oldItem) {
          // Item is added in the new data
          if (!changesMap[item.date]) changesMap[item.date] = {};
          changesMap[item.date][item.care] = 'ADDED';
          
          detailedChanges.push({
            type: 'ADDED',
            date: item.date,
            period: item.care,
            newValue: item.values,
            oldValue: null
          });
        } else if (compareValues(oldItem.values, item.values)) {
          // Item exists but values changed
          if (!changesMap[item.date]) changesMap[item.date] = {};
          changesMap[item.date][item.care] = 'CHANGED';
          
          detailedChanges.push({
            type: 'CHANGED',
            date: item.date,
            period: item.care,
            newValue: item.values,
            oldValue: oldItem.values
          });
          
          // Mark as processed
          oldItemsMap[key].processed = true;
        } else {
          // Item exists and is unchanged
          oldItemsMap[key].processed = true;
        }
      });
      
      // Find removed items
      Object.values(oldItemsMap).forEach(item => {
        if (!item.processed) {
          const key = createKey(item);
          if (!changesMap[item.date]) changesMap[item.date] = {};
          changesMap[item.date][item.care] = 'REMOVED';
          
          detailedChanges.push({
            type: 'REMOVED',
            date: item.date,
            period: item.care,
            newValue: null,
            oldValue: item.values
          });
        }
      });
      
      // Use the formatCareTableData function for consistent formatting
      let oldFormatted = formatCareTableData(oldArray);
      let newFormatted = formatCareTableData(newArray);
      
      // Add changes information to both formatted datasets
      if (typeof oldFormatted === 'object' && oldFormatted.formatted) {
        oldFormatted.changes = changesMap;
        oldFormatted.detailedChanges = detailedChanges;
      }
      
      if (typeof newFormatted === 'object' && newFormatted.formatted) {
        newFormatted.changes = changesMap;
        newFormatted.detailedChanges = detailedChanges;
      }
      
      return {
        oldFormatted,
        newFormatted,
        detailedChanges
      };
    } catch (e) {
      console.error('Error comparing care data:', e);
      return {
        oldFormatted: 'Error comparing care schedules',
        newFormatted: 'Error comparing care schedules'
      };
    }
  };

  const parseGoalDiff = (oldData, newData) => {
    if (!oldData && !newData) return null;
    
    // Parse the goal data from different possible formats
    const parseGoalData = (data) => {
      if (!data) return [];
      
      try {
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch (e) {
            console.error("Error parsing goal data string:", e);
            return [];
          }
        } else if (typeof data === 'object' && data.goals && Array.isArray(data.goals)) {
          return data.goals;
        } else if (Array.isArray(data)) {
          return data;
        }
        return [];
      } catch (e) {
        console.error("Error in parseGoalData:", e);
        return [];
      }
    };
  
    // Parse both sets of data
    const oldGoals = parseGoalData(oldData);
    const newGoals = parseGoalData(newData);
    
    // If we have no data to show, return null
    if ((!oldGoals || oldGoals.length === 0) && (!newGoals || newGoals.length === 0)) {
      return null;
    }
    
    // Helper to determine if goals are significantly different
    const areGoalsDifferent = (goal1, goal2) => {
      if (!goal1 || !goal2) return true;
      
      return (
        goal1.goal !== goal2.goal ||
        goal1.service !== goal2.service ||
        goal1.expect !== goal2.expect ||
        goal1.rate !== goal2.rate ||
        JSON.stringify(goal1.funding) !== JSON.stringify(goal2.funding)
      );
    };
  
    // For added or removed goals, simply show them
    if (oldGoals.length === 0 && newGoals.length > 0) {
      // All goals are new
      return {
        type: 'all-new',
        goals: newGoals
      };
    }
    
    if (newGoals.length === 0 && oldGoals.length > 0) {
      // All goals were removed
      return {
        type: 'all-removed',
        goals: oldGoals
      };
    }
    
    // Otherwise, we need to compare the goals
    // This is a simplified comparison that assumes goals are in the same order
    const maxLength = Math.max(oldGoals.length, newGoals.length);
    const comparisonItems = [];
    
    for (let i = 0; i < maxLength; i++) {
      const oldGoal = i < oldGoals.length ? oldGoals[i] : null;
      const newGoal = i < newGoals.length ? newGoals[i] : null;
      
      if (!oldGoal && newGoal) {
        // Goal was added
        comparisonItems.push({
          type: 'ADDED',
          newGoal
        });
      } else if (oldGoal && !newGoal) {
        // Goal was removed
        comparisonItems.push({
          type: 'REMOVED',
          oldGoal
        });
      } else if (areGoalsDifferent(oldGoal, newGoal)) {
        // Goal was changed
        comparisonItems.push({
          type: 'CHANGED',
          oldGoal,
          newGoal
        });
      }
    }
    
    // If no differences, return null
    if (comparisonItems.length === 0) {
      return null;
    }
    
    // Return the comparison data
    return {
      type: 'comparison',
      items: comparisonItems
    };
  };

  return editBooking ? <BookingEditView booking={booking} updateEditStatus={(value) => setEditBooking(value)} /> : (
    <React.Fragment>
      {booking && (
        <div className="bg-white mr-8">
          {user && user.type == 'user' && (
            <React.Fragment>
              {booking.hasOwnProperty('Rooms') ? (<div className="mb-16 w-full">
                <h1 className="text-2xl text-sargood-blue font-bold mb-5">
                  Accommodation Type
                </h1>
                <div className="flex flex-col md:flex-row md:space-x-5">
                  <Image
                    className="rounded-lg overflow-hidden"
                    width={400}
                    height={270}
                    alt="hotel"
                    src={`/hotel-sample.png`}
                  // TODO - UPDATE THE IMAGE LINK
                  />
                  <div className="flex flex-col w-full">
                    <div className="flex flex-col items-center md:flex-row justify-between md:items-start">
                      <h2 className="text-2xl">{booking.Rooms.length > 0 && booking.Rooms[0].label}</h2>
                      {/* <span className="bg-yellow-600 px-6 py-1 rounded-full text-white">
                        New
                      </span> */}
                    </div>
                    <div className="flex flex-col text-center items-center md:flex-row justify-between md:space-x-3 mt-3">
                      <Box>
                        <Image
                          alt={"check in sargood"}
                          src={"/icons/arrow-right.png"}
                          width={40}
                          height={40}
                        />
                        <p>Check-in</p>
                        <p className="text-lg font-bold">{getCheckInCheckOutDate('checkIn')}</p>
                      </Box>
                      <Box>
                        <Image
                          alt={"check in sargood"}
                          src={"/icons/arrow-left.png"}
                          width={40}
                          height={40}
                        />
                        <p>Check-out</p>
                        <p className="text-lg font-bold">{getCheckInCheckOutDate('checkOut')}</p>
                      </Box>
                      <Box>
                        <span className="flex justify-center text-center items-center">
                          <svg fill="#60BCB6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="m-1 mb-[10px] w-8 h-8">
                            <path d="M8 16v20.5c0 3.584 2.916 6.5 6.5 6.5h19c3.584 0 6.5-2.916 6.5-6.5V16H8zM28.5 25h-9c-.829 0-1.5-.672-1.5-1.5s.671-1.5 1.5-1.5h9c.829 0 1.5.672 1.5 1.5S29.329 25 28.5 25zM39.5 14h-31C7.122 14 6 12.879 6 11.5v-4C6 6.121 7.122 5 8.5 5h31C40.878 5 42 6.121 42 7.5v4C42 12.879 40.878 14 39.5 14z" />
                          </svg>
                        </span>
                        <p>Package</p>
                        <p className="text-lg font-bold">{packageType}</p>
                      </Box>
                      <Box>
                        <Image
                          alt={"check in sargood"}
                          src={"/icons/user-green.png"}
                          width={40}
                          height={40}
                        />
                        <p>Guest</p>
                        <p className="text-lg font-bold">{booking.Rooms.length > 0 && getTotalGuests(booking.Rooms[0])}</p>
                      </Box>
                    </div>
                  </div>
                </div>
              </div>) :
                (<div className="mb-16"><h1 className="text-2xl text-sargood-blue font-bold mb-5">
                  Accommodation Type
                </h1>
                  <div className="bg-yellow-100 rounded-lg py-5 px-6 mb-4 text-base" role="alert">
                    {/* <h4 className="text-2xl font-medium leading-tight mb-2">Room Setup</h4> */
                    }
                    <p className="mb-4">
                      The guest has not selected a room yet. Room setup will be available once the guest has selected a room.
                    </p>
                  </div>
                </div>)}
              {booking.Rooms.length > 1 && (
                <div className="mb-16">
                  <h2 className="text-xl text-sargood-blue font-semibold mb-5">Additional Rooms</h2>
                  <Box>
                    <ul className="space-y-4">
                      {booking.Rooms.slice(1).map((room, index) => (
                        <li key={index} className="flex items-center space-x-4">
                          <div className="relative w-16 h-16 overflow-hidden rounded-md">
                            <Image
                              alt={`Room ${room.label}`}
                              src="/hotel-sample.png"
                              layout="fill"
                              objectFit="cover"
                            />
                          </div>
                          <p className="font-medium">{room.label}</p>
                        </li>
                      ))}
                    </ul>
                  </Box>
                </div>
              )}
              {amendments.length > 0 && <div className="mb-16">
                <h1 className="text-2xl text-sargood-blue font-bold mb-5 w-full">Recent Amendments ({amendments.length})</h1>
                <Box>
                  {amendments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((amendment, index) => {
                    let qaPair = amendment.data.hasOwnProperty('qa_pair') ? amendment.data.qa_pair : amendment.data;
                    let oldAnswerStr = '';
                    let answerStr = '';
                    let goalDiffData = null;
                    
                    if (qaPair.question_type === 'care-table' && qaPair.answer && qaPair.oldAnswer) {
                      try {
                        const { oldFormatted, newFormatted } = parseCareDiff(qaPair.oldAnswer, qaPair.answer);
                        oldAnswerStr = oldFormatted;
                        answerStr = newFormatted;
                      } catch (e) {
                        console.error('Error in care diff:', e);
                        oldAnswerStr = parseAnswer(qaPair.oldAnswer, qaPair.question_type);
                        answerStr = parseAnswer(qaPair.answer, qaPair.question_type);
                      }
                    } 
                    // Handle goal-table specially
                    else if (qaPair.question_type === 'goal-table' && qaPair.answer) {
                      // Get the goal diff data
                      goalDiffData = parseGoalDiff(qaPair.oldAnswer, qaPair.answer);
                      
                      // Also keep the regular parsed answers as fallback
                      oldAnswerStr = parseAnswer(qaPair.oldAnswer, qaPair.question_type);
                      answerStr = parseAnswer(qaPair.answer, qaPair.question_type);
                    } else {
                      // Handle other types
                      oldAnswerStr = parseAnswer(qaPair.oldAnswer, qaPair.question_type);
                      answerStr = parseAnswer(qaPair.answer, qaPair.question_type);
                    }

                    // TODO: Handle checkbox special case
                    // if (qa.question_type === 'checkbox' && answer) {
                    //   answerStr = JSON.parse(answer);

                    //   if (!qa.question && answer && qa.question_type !== 'goal-table' && qa.question_type !== 'care-table') {
                    //     const lastAnswer = answer[answer.length - 1];
                    //     console.log('answer', answer, lastAnswer);
                    //     if (lastAnswer === 'Tick box if applicable') {
                    //       answer = [{ label: lastAnswer.replace("Tick box if applicable", ""), value: "Yes" }];
                    //     } else {
                    //       answer = [{ label: "", value: "Yes" }];
                    //     }
                    //   }
                    // }
                    
                    let question = qaPair.question;
                    if (qaPair.question.startsWith('Preferred') || qaPair.question.startsWith('Duration')) {
                      question = `${question} (${qaPair.sectionLabel})`
                    } else if (qaPair.question_type === 'care-table' && !question) {
                      question = 'Care Schedule Changes';
                    } else if (qaPair.question_type === 'goal-table' && !question) {
                      question = 'Exercise Goal Changes';
                    }

                    return <div key={index}>
                      <div className="items-center w-full mt-3 mb-5 text-sm">
                        <div className="flex flex-col md:flex-row justify-between items-center">
                          <p className="font-bold pb-1">{question}</p>
                          {amendment.data.hasOwnProperty('approved') &&
                            <div className="approval-wrapper">
                              {(!amendment.data.approved && amendment.data?.modifiedBy != 'admin') && <button disabled={globalLoading} className="bg-sargood-blue h-fit p-2 text-xs rounded-md text-white hover:bg-sky-700 disabled:bg-slate-600" onClick={handleApproveDeclineAmendment(amendment, true)}>Approve</button>}
                            </div>}
                        </div>
                        <div className="flex flex-col space-y-2">
                          {qaPair.question_type === 'care-table' ? (
                            <div className="care-amendment">
                              {typeof oldAnswerStr === 'object' && oldAnswerStr.formatted && typeof answerStr === 'object' && answerStr.formatted ? (
                                <CareTableDisplay 
                                  data={answerStr} 
                                  oldData={oldAnswerStr}
                                />
                              ) : (
                                <>
                                  <div className="line-through text-gray-500">
                                    <pre className="whitespace-pre-wrap font-sans text-sm">{String(oldAnswerStr)}</pre>
                                  </div>
                                  <div>
                                    <pre className="whitespace-pre-wrap font-sans text-sm">{String(answerStr)}</pre>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : qaPair.question_type === 'goal-table' && goalDiffData ? (
                            <div className="bg-gray-50 p-3 rounded-md">
                              {goalDiffData.type === 'all-new' && (
                                <>
                                  <div className="text-green-600 font-medium mb-2">New Goals Added:</div>
                                  {goalDiffData.goals.map((goal, idx) => (
                                    <div key={idx} className="pl-2 border-l-2 border-green-500 mb-3">
                                      <div className="mb-3 pl-2">
                                        <div className="font-medium">{goal.goal}</div>
                                        <div className="ml-4 text-sm">
                                          <div><span className="font-medium">Service:</span> {goal.service || 'N/A'}</div>
                                          <div><span className="font-medium">Expected outcome:</span> {goal.expect || 'N/A'}</div>
                                          <div>
                                            <span className="font-medium">Funding request:</span>{" "}
                                            {goal.funding && goal.funding.length > 0 
                                              ? goal.funding.join(', ')
                                              : 'N/A'
                                            }
                                          </div>
                                          <div><span className="font-medium">Rate:</span> {goal.rate || 'N/A'}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              )}
                              
                              {goalDiffData.type === 'all-removed' && (
                                <>
                                  <div className="text-red-600 font-medium mb-2">All Goals Removed:</div>
                                  {goalDiffData.goals.map((goal, idx) => (
                                    <div key={idx} className="pl-2 border-l-2 border-red-500 mb-3 line-through text-gray-500">
                                      <div className="mb-3 pl-2">
                                        <div className="font-medium">{goal.goal}</div>
                                        <div className="ml-4 text-sm">
                                          <div><span className="font-medium">Service:</span> {goal.service || 'N/A'}</div>
                                          <div><span className="font-medium">Expected outcome:</span> {goal.expect || 'N/A'}</div>
                                          <div>
                                            <span className="font-medium">Funding request:</span>{" "}
                                            {goal.funding && goal.funding.length > 0 
                                              ? goal.funding.join(', ')
                                              : 'N/A'
                                            }
                                          </div>
                                          <div><span className="font-medium">Rate:</span> {goal.rate || 'N/A'}</div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              )}
                              
                              {goalDiffData.type === 'comparison' && goalDiffData.items.map((item, idx) => (
                                <div key={idx} className="mb-4">
                                  {item.type === 'ADDED' && (
                                    <div>
                                      <div className="text-green-600 font-medium mb-1">Goal Added:</div>
                                      <div className="pl-2 border-l-2 border-green-500">
                                        <div className="mb-3 pl-2">
                                          <div className="font-medium">{item.newGoal.goal}</div>
                                          <div className="ml-4 text-sm">
                                            <div><span className="font-medium">Service:</span> {item.newGoal.service || 'N/A'}</div>
                                            <div><span className="font-medium">Expected outcome:</span> {item.newGoal.expect || 'N/A'}</div>
                                            <div>
                                              <span className="font-medium">Funding request:</span>{" "}
                                              {item.newGoal.funding && item.newGoal.funding.length > 0 
                                                ? item.newGoal.funding.join(', ')
                                                : 'N/A'
                                              }
                                            </div>
                                            <div><span className="font-medium">Rate:</span> {item.newGoal.rate || 'N/A'}</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {item.type === 'REMOVED' && (
                                    <div>
                                      <div className="text-red-600 font-medium mb-1">Goal Removed:</div>
                                      <div className="pl-2 border-l-2 border-red-500 line-through text-gray-500">
                                        <div className="mb-3 pl-2">
                                          <div className="font-medium">{item.oldGoal.goal}</div>
                                          <div className="ml-4 text-sm">
                                            <div><span className="font-medium">Service:</span> {item.oldGoal.service || 'N/A'}</div>
                                            <div><span className="font-medium">Expected outcome:</span> {item.oldGoal.expect || 'N/A'}</div>
                                            <div>
                                              <span className="font-medium">Funding request:</span>{" "}
                                              {item.oldGoal.funding && item.oldGoal.funding.length > 0 
                                                ? item.oldGoal.funding.join(', ')
                                                : 'N/A'
                                              }
                                            </div>
                                            <div><span className="font-medium">Rate:</span> {item.oldGoal.rate || 'N/A'}</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  {item.type === 'CHANGED' && (
                                    <div>
                                      <div className="text-orange-600 font-medium mb-1">Goal Changed:</div>
                                      <div className="pl-2 border-l-2 border-gray-300">
                                        <div className="line-through text-gray-500 mb-2 pl-2">
                                          <div className="font-medium">{item.oldGoal.goal}</div>
                                          <div className="ml-4 text-sm">
                                            <div><span className="font-medium">Service:</span> {item.oldGoal.service || 'N/A'}</div>
                                            <div><span className="font-medium">Expected outcome:</span> {item.oldGoal.expect || 'N/A'}</div>
                                            <div>
                                              <span className="font-medium">Funding request:</span>{" "}
                                              {item.oldGoal.funding && item.oldGoal.funding.length > 0 
                                                ? item.oldGoal.funding.join(', ')
                                                : 'N/A'
                                              }
                                            </div>
                                            <div><span className="font-medium">Rate:</span> {item.oldGoal.rate || 'N/A'}</div>
                                          </div>
                                        </div>
                                        <div className="border-l-2 border-orange-500 pl-2">
                                          <div className="font-medium">{item.newGoal.goal}</div>
                                          <div className="ml-4 text-sm">
                                            <div><span className="font-medium">Service:</span> {item.newGoal.service || 'N/A'}</div>
                                            <div><span className="font-medium">Expected outcome:</span> {item.newGoal.expect || 'N/A'}</div>
                                            <div>
                                              <span className="font-medium">Funding request:</span>{" "}
                                              {item.newGoal.funding && item.newGoal.funding.length > 0 
                                                ? item.newGoal.funding.join(', ')
                                                : 'N/A'
                                              }
                                            </div>
                                            <div><span className="font-medium">Rate:</span> {item.newGoal.rate || 'N/A'}</div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            // Regular display for other types
                            <>
                              {oldAnswerStr && (
                                <div className="line-through text-gray-500">
                                  {typeof oldAnswerStr === 'object' && oldAnswerStr.formatted ? 
                                    <GoalTableDisplay data={oldAnswerStr} /> : 
                                    <pre className="whitespace-pre-wrap font-sans text-sm">{oldAnswerStr}</pre>
                                  }
                                </div>
                              )}
                              <div>
                                {typeof answerStr === 'object' && answerStr.formatted ? 
                                  <GoalTableDisplay data={answerStr} /> : 
                                  <pre className="whitespace-pre-wrap font-sans text-sm">{answerStr}</pre>
                                }
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex flex-col md:flex-row justify-between mt-2">
                          {amendment.data.approved ? <div className="flex items-center space-x-2">
                            <Image
                              alt={"check in sargood"}
                              src={"/icons/check-green.png"}
                              width={18}
                              height={18} />
                            <p className="text-xs">Approved <span>{amendment.data.approved_by != null && `by ${amendment.data.approved_by} ${moment.duration(moment(amendment.data.approval_date).diff(moment())).humanize(true)}`}</span></p>
                          </div> : <div></div>}
                          <p className="text-slate-500 text-xs">amended {moment.duration(moment(amendment.createdAt).diff(moment())).humanize(true)}</p>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-end">
                        </div>
                      </div>
                      {index != amendments.length - 1 && <hr className="border border-slate-300" />}
                    </div>
                  })}
                </Box>
              </div>}
              <div className="mb-16">
                <AssetsAndEquipment equipmentsData={booking.Equipment} bookingId={booking.id} />
              </div>
              {booking.hasOwnProperty('Rooms') ? (<div className="flex flex-col mb-16">
                <h1 className="text-2xl text-sargood-blue font-bold mb-5">Room Setup</h1>
                <div className="flex flex-col space-y-3 md:space-y-0 md:flex-row justify-between md:space-x-5 mb-5">
                  <Box>
                    <p className="font-bold mb-3">Adults</p>
                    <div className="flex items-center space-x-5">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p>{booking.Rooms.length > 0 && booking?.Rooms[0].adults}</p>
                    </div>
                  </Box>
                  <Box>
                    <p className="font-bold mb-3">Children</p>
                    <div className="flex items-center space-x-5">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p>{booking.Rooms.length > 0 && booking?.Rooms[0].children}</p>
                    </div>
                  </Box>
                  <Box>
                    <p className="font-bold mb-3">Infants</p>
                    <div className="flex items-center space-x-5">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p>{booking.Rooms.length > 0 && booking?.Rooms[0].infants || 0}</p>
                    </div>
                  </Box>
                  <Box>
                    <p className="font-bold mb-3">Pets</p>
                    <div className="flex items-center space-x-5">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p>{booking.Rooms.length > 0 && booking?.Rooms[0].pets}</p>
                    </div>
                  </Box>
                </div>
                <div className="mb-5">
                  {booking.Rooms.length > 0 && booking.Rooms[0].guests?.length && <Box>
                    <h4 className="font-bold">Guest List</h4>
                    <div className="flex flex-wrap space-y-4">
                      {JSON.parse(booking?.Rooms[0].guests).map((guest, index) => (
                        <div key={index} className="flex space-x-5 items-center w-1/2">
                          <Image
                            alt={"check in sargood"}
                            src={"/icons/check-green.png"}
                            width={20}
                            height={20} />
                          <p>{guest.name}</p>
                        </div>
                      ))}
                    </div>
                  </Box>}
                </div>
              </div>) : null}
              {bookingPackage && <div className="mb-16">
                <h1 className="text-2xl text-sargood-blue font-bold mb-5">Packages</h1>
                <Box>
                  <div className="flex items-start justify-between space-x-6">
                    <div className="flex space-x-5 items-center w-full mt-3 mb-5">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p>{bookingPackage}</p>
                    </div>
                  </div>
                </Box>
              </div>}
              {bookingFunder && <div className="mb-16">
                <h1 className="text-2xl text-sargood-blue font-bold mb-5">Funder Type</h1>
                <Box>
                  <div className="flex items-start justify-between space-x-6">
                    <div className="flex space-x-5 items-center w-full mt-3 mb-5">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p>{bookingFunder}</p>
                    </div>
                  </div>
                </Box>
              </div>}
              {course && <div className="mb-16">
                <h1 className="text-2xl text-sargood-blue font-bold mb-5">Courses</h1>
                <Box>
                  <div className="flex items-start justify-between space-x-6">
                    {course.length > 0 ?
                      (<div className="flex space-x-5 items-center w-full mt-3 mb-5">
                        <Image
                          alt={"check in sargood"}
                          src={"/icons/check-green.png"}
                          width={20}
                          height={20}
                        />
                        <p>{course}</p>
                      </div>)
                      : <span className="italic text-gray-500 text-base">No course selected.</span>
                    }
                  </div>
                </Box>
              </div>}
              {healthInfoLastUpdate && <div>
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl text-sargood-blue font-bold mb-5">Health Info</h1>
                  <p className="text-slate-500">{healthInfoLastUpdate && `Last Update: ${moment(healthInfoLastUpdate).format('DD/MM/YYYY')}`}</p>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between">
                    <p className="p-4 font-bold">Description</p>
                    <div className="flex justify-between">
                      <p className="p-4 font-bold mr-4">Last Stay</p>
                      <p className="p-4 font-bold">Current Stay</p>
                    </div>
                  </div>
                  {healthInfo.map((health, index) =>
                    <Box key={index} bg={(index % 2) !== 0 && 'bg-white'}>
                      <div className="flex justify-between">
                        <p className="max-w-[50%]">{health.diagnose}</p>
                        <div className="flex justify-between w-48">
                          {booking.type === 'Returning Guest' ?
                            <p className={`font-bold  ${health.prev_answer ? 'text-emerald-400' : 'text-red-500'}`}>{health.prev_answer ? 'Yes' : 'No'}</p> :
                            <p className={`font-bold}`}>-</p>
                          }
                          <p className={`font-bold ${health.answer ? 'text-emerald-400' : 'text-red-500'}`}>{health.answer ? 'Yes' : 'No'}</p>
                        </div>
                      </div>
                    </Box>)}
                </div>
              </div>}
            </React.Fragment>
          )}
          {Object.keys(sortedSections).map((sectionTitle, index) => <div key={index} className="mt-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl text-sargood-blue font-bold mt-10">{sectionTitle}</h1>
            </div>
            <div className="mt-4">
              {sortedSections[sectionTitle].map((section, index) =>
                <div className={`my-10 ${(user?.type == 'user' && section.QaPairs.some(qaPair => qaPair.question_type === 'equipment')) && 'hidden'}`} key={index}>
                  {section.QaPairs.some(qaPair => qaPair.answer) && <Box key={index}>
                    <div className="flex justify-between mb-4">
                      <p className="font-bold">{section.label}</p>
                    </div>
                    {section.QaPairs.length > 0 ?
                      <div className={`grid grid-cols-1 md:grid-cols-${getNumberOfColumns(section.type)} gap-2`}>
                        {section.QaPairs.sort((a, b) => { return a.id - b.id }).map((qa, index) => {
                          let answer = qa.answer;

                          if (qa.question.startsWith('I verify')) {
                            answer = answer == 1 ? 'Yes' : 'No';
                          }

                          if (user.type == 'user' && qa.question_type == 'equipment') return;

                          if (user.type == 'guest' && qa.question_type == 'equipment') {
                            answer = equipments;
                          }

                          if (answer && qa.question_type === 'date' || qa.question_type === 'date-range') {
                            if (qa.question_type === 'date') {
                              answer = moment(answer).format('DD/MM/YYYY');
                            } else {
                              const answerArr = answer.split(' - ');
                              answer = moment(answerArr[0]).format('DD/MM/YYYY') + ' - ' + moment(answerArr[1]).format('DD/MM/YYYY');
                            }
                          } else if (answer && qa.question_type === "rooms") {
                            answer = JSON.parse(answer);
                          } else if (qa.question_type === 'goal-table') {
                            answer = parseAnswer(answer, qa.question_type);
                          } else if (qa.question_type === 'care-table') {
                            answer = parseAnswer(answer, qa.question_type);
                          } else if (answer && isJsonString(answer)) {
                            const answerObj = JSON.parse(answer);

                            if (qa.question_type === 'checkbox' && answer) {
                              answer = JSON.parse(answer);

                              if (!qa.question && answer && qa.question_type !== 'goal-table' && qa.question_type !== 'care-table') {
                                const lastAnswer = answer[answer.length - 1];
                                console.log('answer', answer, lastAnswer);
                                if (lastAnswer === 'Tick box if applicable') {
                                  answer = [{ label: lastAnswer.replace("Tick box if applicable", ""), value: "Yes" }];
                                } else {
                                  answer = [{ label: "", value: "Yes" }];
                                }
                              }
                            } else if (typeof answerObj !== 'number') {
                              answer = answerObj ? answerObj.toString().replace(',', ', ') : answerObj;
                            }
                          }

                          const handleViewFile = async (filename) => {
                            const url = await getFileUrl(filename, `booking_request_form/${booking.Guest.id}/`);

                            let link = document.createElement("a");
                            link.download = filename;
                            link.href = url;
                            link.target = "_blank";
                            link.click();
                          }

                          return (
                            <React.Fragment key={index}>
                              {answer && (
                                <div key={index} className={`w-full ${(_.map(amendments, 'data.question')).includes(qa.question) && 'bg-yellow-200/80 p-2 rounded-md'}`}>
                                  {(qa.label || qa.question) && <p className="font-bold !whitespace-pre-wrap mb-2">{qa.label || qa.question}</p>}
                                  <div className="flex flex-row justify-between">
                                    {(typeof answer === "object" && (qa.question_type === 'rooms' || qa.question_type == 'checkbox' || qa.question_type == 'equipment')) ? (
                                      <React.Fragment>
                                        <ul className={`${qa.question ? 'list-disc' : ''}`}>
                                          {answer.map((a, i) => {
                                            return (
                                              <React.Fragment key={i}>
                                                {qa.question_type === 'rooms' ? (
                                                  <li className="ml-8" key={i}>{a.name}</li>
                                                ) : (
                                                  <React.Fragment>
                                                    {qa.question ? (
                                                      <li className="ml-8" key={i}>{a}</li>
                                                    ) : (
                                                      <li key={i} className="flex gap-1">
                                                        <div className="relative min-w-5 min-h-5 w-5 h-5">
                                                          <Image
                                                            alt={"check in sargood"}
                                                            src={"/icons/check-green.png"}
                                                            layout="fill"
                                                            objectFit="contain"
                                                          />
                                                        </div>
                                                        <span className="font-bold">{a.label}</span></li>
                                                    )}
                                                  </React.Fragment>
                                                )}
                                              </React.Fragment>
                                            )
                                          })}
                                        </ul>
                                      </React.Fragment>
                                    ) : (
                                      <div className="w-full grid grid-cols-1 md:grid-cols-6 gap-4">
                                        {qa.question_type === 'care-table' && typeof answer === 'object' && answer.formatted ? (
                                          <div className="md:col-span-6">
                                            <CareTableDisplay data={answer} />
                                          </div>
                                        ) : qa.question_type === 'goal-table' && typeof answer === 'object' && answer.formatted ? (
                                          <div className="md:col-span-6">
                                            <GoalTableDisplay data={answer} />
                                          </div>
                                        ) : qa.question_type === 'goal-table' ? (
                                          <div className="md:col-span-6">
                                            <GoalTableDisplay data={answer} />
                                          </div>
                                        ) : (
                                          <pre className="md:col-start-1 md:col-end-3 whitespace-pre-wrap font-sans text-sm">{answer || 'N/A'}</pre>
                                        )}
                                        {qa.question_type === "file-upload" && (
                                          <span className="md:col-end-7 md:col-span-2 cursor-pointer underline text-base text-sargood-blue" onClick={() => handleViewFile(answer)}>View File</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </div>
                      : <p className="text-gray-500">None of the questions have been answered yet.</p>}
                  </Box>}
                </div>)}
            </div>
          </div>)}
        </div >
      )
      }
    </React.Fragment >
  );
}

export default React.forwardRef(BookingDetailComp);

const GoalTableDisplay = ({ data }) => {
  // If data is not in the expected format, fall back to basic display
  if (!data) {
    return <pre className="whitespace-pre-wrap font-sans text-sm">No goal data available</pre>;
  }
  
  // Try to parse the data if it's a string
  let parsedGoals = [];
  try {
    if (typeof data === 'string') {
      // Try to parse as JSON first
      try {
        parsedGoals = JSON.parse(data);
      } catch (e) {
        // Not valid JSON, try parsing the formatted text
        const goalLines = data.split('\n\n');
        parsedGoals = goalLines.map(goalBlock => {
          const lines = goalBlock.split('\n');
          const goalText = lines[0].replace(/^Goal \d+: /, '');
          
          // Create a goal object with the available information
          const goal = { goal: goalText };
          
          lines.slice(1).forEach(line => {
            const match = line.match(/^\s\s([^:]+): (.+)$/);
            if (match) {
              const key = match[1].trim().toLowerCase();
              const value = match[2].trim();
              
              if (key === 'service') goal.service = value;
              else if (key === 'expected outcome') goal.expect = value;
              else if (key === 'funding') goal.funding = value.split(', ');
              else if (key === 'rate') goal.rate = value;
            }
          });
          
          return goal;
        });
      }
    } else if (Array.isArray(data)) {
      // Data is already an array
      parsedGoals = data;
    } else if (typeof data === 'object' && data.goals && Array.isArray(data.goals)) {
      // Handle the case when formatGoalTableData returns {formatted: true, goals: [...]}
      parsedGoals = data.goals;
    }
    
    // If no goals parsed, fall back to basic display
    if (parsedGoals.length === 0) {
      return <pre className="whitespace-pre-wrap font-sans text-sm">{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</pre>;
    }
    
    // Render as a table
    return (
      <div className="goal-table overflow-x-auto">
        <table className="min-w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Goal</th>
              <th className="border p-2 text-left">What new service is needed to achieve this goal?</th>
              <th className="border p-2 text-left">What to expect?</th>
              <th className="border p-2 text-left">Funding request?</th>
              <th className="border p-2 text-left">Hourly rate</th>
            </tr>
          </thead>
          <tbody>
            {parsedGoals.map((goal, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="border p-2">
                  {goal.specificGoal 
                    ? goal.goal.replace('PLEASE WRITE HERE', goal.specificGoal)
                    : goal.goal}
                </td>
                <td className="border p-2">{goal.service || '-'}</td>
                <td className="border p-2">{goal.expect || '-'}</td>
                <td className="border p-2">
                  {goal.funding && goal.funding.length > 0 ? (
                    <ul className="list-disc pl-5">
                      {goal.funding.map((item, idx) => (
                        <li key={idx} className="text-sm">{item}</li>
                      ))}
                    </ul>
                  ) : '-'}
                </td>
                <td className="border p-2">{goal.rate || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } catch (e) {
    console.error("Error rendering goal table:", e);
    // If parsing fails, fall back to basic pre display
    return <pre className="whitespace-pre-wrap font-sans text-sm">{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</pre>;
  }
};

const CareTableDisplay = ({ data, oldData }) => {
  if (!data || !data.formatted || !data.dates) {
    return <pre className="whitespace-pre-wrap font-sans text-sm">{String(data)}</pre>;
  }
  
  // For amendments, we only want to show what changed
  const hasChanges = data.detailedChanges && data.detailedChanges.length > 0;
  
  if (!hasChanges) {
    // If there are no detailed changes, fall back to regular display
    return (
      <div className="care-table bg-gray-50 p-3 rounded-md">
        {data.dates.map((dateItem, dateIndex) => (
          <div key={dateIndex} className="mb-4">
            <div className="font-bold border-b pb-1 mb-2">{dateItem.date}</div>
            
            {dateItem.periods.morning && (
              <div className="ml-4 flex items-center mb-1">
                <span className="text-yellow-500 mr-2">☀️</span>
                <span>Morning: {dateItem.periods.morning.time} ({dateItem.periods.morning.duration}) - {dateItem.periods.morning.carers} carer(s)</span>
              </div>
            )}
            
            {dateItem.periods.afternoon && (
              <div className="ml-4 flex items-center mb-1">
                <span className="text-orange-500 mr-2">🌤️</span>
                <span>Afternoon: {dateItem.periods.afternoon.time} ({dateItem.periods.afternoon.duration}) - {dateItem.periods.afternoon.carers} carer(s)</span>
              </div>
            )}
            
            {dateItem.periods.evening && (
              <div className="ml-4 flex items-center mb-1">
                <span className="text-blue-900 mr-2">🌙</span>
                <span>Evening: {dateItem.periods.evening.time} ({dateItem.periods.evening.duration}) - {dateItem.periods.evening.carers} carer(s)</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  
  // Group changes by date for display
  const changesByDate = {};
  data.detailedChanges.forEach(change => {
    if (!changesByDate[change.date]) {
      changesByDate[change.date] = [];
    }
    changesByDate[change.date].push(change);
  });
  
  // Get the emoji icon for a period
  const getPeriodIcon = (period, isOld = false) => {
    if (period === 'morning') {
      return <span className={`${isOld ? 'text-gray-400' : 'text-yellow-500'} mr-2`}>☀️</span>;
    } else if (period === 'afternoon') {
      return <span className={`${isOld ? 'text-gray-400' : 'text-orange-500'} mr-2`}>🌤️</span>;
    } else if (period === 'evening') {
      return <span className={`${isOld ? 'text-gray-400' : 'text-blue-900'} mr-2`}>🌙</span>;
    }
    return null;
  };
  
  // Format a care value for display
  const formatCareValue = (value) => {
    if (!value) return 'None';
    return `${value.time} (${value.duration}) - ${value.carers} carer(s)`;
  };
  
  // Get the appropriate change label for a change type
  const getChangeLabel = (type) => {
    if (type === 'ADDED') {
      return <span className="ml-2 text-green-600 text-xs">[ADDED]</span>;
    } else if (type === 'REMOVED') {
      return <span className="ml-2 text-red-600 text-xs">[REMOVED]</span>;
    } else if (type === 'CHANGED') {
      return <span className="ml-2 text-orange-600 text-xs">[CHANGED]</span>;
    }
    return null;
  };
  
  // Render the amendment view with old and new values side by side
  return (
    <div className="care-table bg-gray-50 p-3 rounded-md">
      {Object.entries(changesByDate).map(([date, changes], dateIndex) => (
        <div key={dateIndex} className="mb-4">
          <div className="font-bold border-b pb-1 mb-2">{date}</div>
          
          {changes.map((change, changeIndex) => (
            <div key={changeIndex} className="ml-4 mb-3">
              {/* Period label (Morning/Afternoon/Evening) */}
              <div className="font-medium capitalize mb-1">
                {change.period}:
                {getChangeLabel(change.type)}
              </div>
              
              {/* For CHANGED type, show both old and new values */}
              {change.type === 'CHANGED' && (
                <>
                  <div className="flex items-center ml-4 line-through text-gray-500 mb-1">
                    {getPeriodIcon(change.period, true)}
                    <span>Old: {formatCareValue(change.oldValue)}</span>
                  </div>
                  <div className="flex items-center ml-4 font-medium">
                    {getPeriodIcon(change.period)}
                    <span>New: {formatCareValue(change.newValue)}</span>
                  </div>
                </>
              )}
              
              {/* For ADDED type, show only new value */}
              {change.type === 'ADDED' && (
                <div className="flex items-center ml-4 font-medium text-green-700">
                  {getPeriodIcon(change.period)}
                  <span>{formatCareValue(change.newValue)}</span>
                </div>
              )}
              
              {/* For REMOVED type, show only old value */}
              {change.type === 'REMOVED' && (
                <div className="flex items-center ml-4 line-through text-gray-500">
                  {getPeriodIcon(change.period, true)}
                  <span>{formatCareValue(change.oldValue)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};