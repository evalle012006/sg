import React, { createContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { statusContext, fetchBookingStatuses } from "../../services/booking/statuses";
import moment from "moment";

import dynamic from 'next/dynamic';
const Table = dynamic(() => import('../ui/table'));

function BookingHistory({ uuid }) {

  const router = useRouter();


  const [data, setData] = useState([]);

  useEffect(() => {
    fetchData();
  }, [uuid]);

  const fetchData = async () => {
    const response = await fetch("/api/bookings/history/list?uuid=" + uuid)

    if (response.ok) {
      const guestData = await response.json();
      setData(guestData.Bookings);
    }
  }

  // const statusContextInstance = React.useContext(statusContext);
  const [statuses, setStatuses] = useState([]);

  useEffect(() => {
    fetchBookingStatuses().then(data => {
      setStatuses(data);
    });
  }, []);

  const columns = useMemo(
    () => [
      {
        Header: "Date",
        accessor: "createdAt",
        Cell: function ({ row: { original } }) {
          // return new Date(original.createdAt).toLocaleDateString();
          return moment(original.createdAt).format('DD/MM/YYYY');
        }
      },
      {
        Header: "Room Type",
        accessor: "type",
      },
      {
        Header: "Check-in",
        accessor: "preferred_arrival_date",
        Cell: function ({ row: { original } }) {
          // return original.preferred_arrival_date ? new Date(original.preferred_arrival_date).toLocaleDateString() : "N/A";
          return original.preferred_arrival_date ? moment(original.preferred_arrival_date).format('DD/MM/YYYY') : "N/A";
        }
      },
      {
        Header: "Check-out",
        accessor: "preferred_departure_date",
        Cell: function ({ row: { original } }) {
          // return original.preferred_departure_date ? new Date(original.preferred_departure_date).toLocaleDateString() : "N/A";
          return original.preferred_departure_date ? moment(original.preferred_departure_date).format('DD/MM/YYYY') : "N/A";
        }
      },
      {
        Header: "Status",
        accessor: "status",
        Cell: function ({ row: { original } }) {
          const statusObj = JSON.parse(original.status);
          return statusObj.label;
        },
      }
    ], [router]);


  return (
    <div className="rounded-md">
      <div className="">
        <statusContext.Provider value={statuses}>
          <Table
            columns={columns}
            apiResult={data}
          />
        </statusContext.Provider>
      </div>
    </div>
  );
}

export default BookingHistory;
