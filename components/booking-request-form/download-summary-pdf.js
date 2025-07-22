import React, { useRef } from 'react';
import ReactToPrint from 'react-to-print';

const PrintToPDF = ({ summary, totalPackageCost, totalRoomCosts, getTotalOutOfPocketExpenses, getGrandTotal }) => {
  const componentRef = useRef();
  
  const formatPrice = (price) => {
    return price?.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) || '0.00';
  };

  return (
    <div>
      <ReactToPrint
        trigger={() => (
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center">
            Download Summary of Stay
          </button>
        )}
        content={() => componentRef.current}
      />
      
      <div style={{ display: 'none' }}>
        <div ref={componentRef}>
          <div className="p-8 bg-white">
            <h1 className="text-2xl font-bold text-slate-700 mb-6">Summary of Your Stay</h1>
            
            {/* Guest Information */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <h3 className="font-semibold text-slate-700 mb-1">Guest Name</h3>
                <p className="text-gray-900 p-2">{summary?.guestName}</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-700 mb-1">Funder</h3>
                <p className="text-gray-900 p-2">{summary?.data?.funder}</p>
              </div>
              
              {summary?.data?.participantNumber && (
                <div>
                  <h3 className="font-semibold text-slate-700 mb-1">
                    {summary?.data?.funder} Participant Number
                  </h3>
                  <p className="text-gray-900 p-2">{summary?.data?.participantNumber}</p>
                </div>
              )}
              
              <div>
                <h3 className="font-semibold text-slate-700 mb-1">Number of Nights</h3>
                <p className="text-gray-900 p-2">{summary?.data?.nights}</p>
              </div>
              
              <div>
                <h3 className="font-semibold text-slate-700 mb-1">Dates of Stay</h3>
                <p className="text-gray-900 p-2">{summary?.data?.datesOfStay}</p>
              </div>
            </div>

            {/* Package Information */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 text-slate-700">Package - cost to be charged to your funder</h2>
              <div className="text-right">
                <p className="font-semibold text-slate-700">Total Package Cost: ${formatPrice(totalPackageCost)}</p>
              </div>
            </div>

            {/* Additional Room and Upgrade Costs */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-slate-700">Additional Room and Upgrade Costs</h2>
              <h3 className="text-sm font-semibold text-slate-700 mb-4">
                To be paid by you privately without prior approval by your funder
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-slate-700 mb-1">Room Upgrade</h3>
                  <p className="text-gray-900 p-2">
                    {totalRoomCosts.roomUpgrade > 0 ? 
                      `$${formatPrice(totalRoomCosts.roomUpgrade)} total` : 
                      'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-700 mb-1">Additional Room</h3>
                  <p className="text-gray-900 p-2">
                    {totalRoomCosts.additionalRoom > 0 ? 
                      `$${formatPrice(totalRoomCosts.additionalRoom)} total` : 
                      'N/A'}
                  </p>
                </div>
              </div>
              <div className="text-right mt-4">
                <p className="font-semibold text-slate-700">
                  Total Out of Pocket: ${formatPrice(getTotalOutOfPocketExpenses())}
                </p>
              </div>
            </div>

            {/* Cost Summary */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h2 className="text-lg font-semibold text-slate-700 mb-4">Cost Summary</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Package Cost:</span>
                  <span>${formatPrice(totalPackageCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Additional Room and Upgrade Costs:</span>
                  <span>${formatPrice(getTotalOutOfPocketExpenses())}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
                  <span>Grand Total:</span>
                  <span>${formatPrice(getGrandTotal())}</span>
                </div>
              </div>
            </div>

            {/* NDIS Questions */}
            {summary?.data?.funder?.includes('NDIS') && summary?.data?.ndisQuestions?.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-4 text-slate-700">NDIS Questions</h2>
                <div className="space-y-4">
                  {summary.data.ndisQuestions.map((item, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                      <h3 className="font-semibold text-slate-700 mb-2">{item.question}</h3>
                      {Array.isArray(item.answer) ? (
                        <ul className="list-disc pl-5 space-y-1">
                          {item.answer.map((ans, idx) => (
                            <li key={idx} className="text-gray-700">{ans}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-700">{item.answer}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintToPDF;