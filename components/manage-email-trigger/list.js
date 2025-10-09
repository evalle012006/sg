import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';

const Table = dynamic(() => import('../ui/table'));
const ToggleButton = dynamic(() => import('../ui/toggle'));
const EmailTriggerForm = dynamic(() => import('./EmailTriggerForm'));


function EmailTriggerList({ refreshData }) {
  const emailTriggerData = useSelector(state => state.emailTrigger.list);
  const [list, setList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    if (isFiltering) {
      setList(filteredData);
    } else {
      setList(emailTriggerData);
    }
  }, [isFiltering, filteredData, emailTriggerData]);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    if (query.trim() === '') {
      setIsFiltering(false);
      return;
    }

    const filtered = emailTriggerData.filter(trigger =>
      trigger.recipient?.toLowerCase().includes(query) ||
      trigger.template_name?.toLowerCase().includes(query) ||
      trigger.type?.toLowerCase().includes(query)
    );

    setFilteredData(filtered);
    setIsFiltering(true);
  };

  const handleCreateNew = () => {
    setSelectedTrigger(null);
    setShowModal(true);
  };

  const handleEdit = (trigger) => {
    setSelectedTrigger(trigger);
    setShowModal(true);
  };

  const handleSave = async (formData) => {
    try {
      const url = selectedTrigger
        ? '/api/email-triggers/update'
        : '/api/email-triggers/create';

      const method = 'POST';
      const payload = selectedTrigger
        ? { ...formData, id: selectedTrigger.id }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to save email trigger');
      }

      toast.success('Email trigger saved successfully');
      setShowModal(false);
      setSelectedTrigger(null);
      refreshData();
    } catch (error) {
      console.error('Error saving trigger:', error);
      throw error;
    }
  };

  const handleToggleEnabled = async (trigger) => {
    try {
      const response = await fetch('/api/email-triggers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...trigger,
          enabled: !trigger.enabled
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update trigger');
      }

      toast.success('Email trigger updated successfully');
      refreshData();
    } catch (error) {
      console.error('Error toggling trigger:', error);
      toast.error('Failed to update trigger');
    }
  };

  const columns = useMemo(
    () => [
      {
        Header: 'Recipient',
        accessor: 'recipient',
        Cell: ({ value }) => (
          <div className="font-medium text-gray-900">{value}</div>
        )
      },
      {
        Header: 'Email Template',
        accessor: 'template_name',
        Cell: ({ row: { original } }) => (
          <div>
            <div className="font-medium">{original.template_name}</div>
            {original.template && (
              <div className="text-xs text-gray-500">
                {original.template.subject}
              </div>
            )}
          </div>
        )
      },
      {
        Header: 'Type',
        accessor: 'type',
        Cell: ({ value }) => {
          const colors = {
            highlights: 'bg-blue-100 text-blue-800',
            external: 'bg-green-100 text-green-800',
            internal: 'bg-purple-100 text-purple-800'
          };
          return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${colors[value] || 'bg-gray-100 text-gray-800'}`}>
              {value}
            </span>
          );
        }
      },
      {
        Header: () => (
          <div className="flex items-center">
            <span>Trigger Conditions</span>
            <div className="relative group ml-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
              </svg>
              <div className="hidden group-hover:block absolute z-10 w-96 bottom-full left-0 mb-2 bg-black/75 text-white p-3 rounded-md text-sm">
                Questions and answers that must match for this trigger to send an email
              </div>
            </div>
          </div>
        ),
        accessor: 'trigger_questions',
        Cell: ({ value }) => (
          <div className="space-y-2">
            {value?.map((question, index) => (
              <div key={index} className="bg-gray-50 rounded p-2 text-sm">
                <p className="font-medium">{index + 1}. {question.question}</p>
                {question.answer && (
                  <p className="text-xs text-gray-600 mt-1">
                    Required answer: <span className="font-medium">{question.answer}</span>
                  </p>
                )}
                {question.question_key && (
                  <p className="text-xs text-gray-500">Key: {question.question_key}</p>
                )}
              </div>
            ))}
            {(!value || value.length === 0) && (
              <span className="text-gray-400 text-sm italic">No conditions set</span>
            )}
          </div>
        )
      },
      {
        Header: 'Statistics',
        accessor: 'trigger_count',
        Cell: ({ row: { original } }) => (
          <div className="text-sm">
            <div>Sent: <span className="font-medium">{original.trigger_count || 0}</span></div>
            {original.last_triggered_at && (
              <div className="text-xs text-gray-500">
                Last: {new Date(original.last_triggered_at).toLocaleDateString()}
              </div>
            )}
          </div>
        )
      },
      {
        Header: 'Status',
        accessor: 'enabled',
        Cell: ({ row: { original } }) => (
          <div className="w-fit" onClick={() => handleToggleEnabled(original)}>
            <ToggleButton status={original.enabled} />
          </div>
        )
      },
      {
        Header: 'Action',
        accessor: 'action',
        Cell: ({ row: { original } }) => (
          <button
            onClick={() => handleEdit(original)}
            className="text-blue-600 hover:text-blue-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
              />
            </svg>
          </button>
        )
      }
    ],
    [refreshData]
  );

  return (
    <div className="pt-4 pb-16">
      <div className="flex flex-row justify-between items-center mb-6">
        <div className="relative w-4/12">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 fill-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30">
              <path d="M 13 3 C 7.4889971 3 3 7.4889971 3 13 C 3 18.511003 7.4889971 23 13 23 C 15.396508 23 17.597385 22.148986 19.322266 20.736328 L 25.292969 26.707031 A 1.0001 1.0001 0 1 0 26.707031 25.292969 L 20.736328 19.322266 C 22.148986 17.597385 23 15.396508 23 13 C 23 7.4889971 18.511003 3 13 3 z M 13 5 C 17.430123 5 21 8.5698774 21 13 C 21 17.430123 17.430123 21 13 21 C 8.5698774 21 5 17.430123 5 13 C 5 8.5698774 8.5698774 5 13 5 z"></path>
            </svg>
          </span>
          <input
            className="w-full bg-white border border-gray-300 rounded-full py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={handleSearch}
            placeholder="Search triggers..."
            type="text"
            value={searchQuery}
          />
        </div>
        
        <button
          onClick={handleCreateNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Trigger
        </button>
      </div>

      <Table columns={columns} apiResult={list} />

      {showModal && (
        <EmailTriggerForm
          trigger={selectedTrigger}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setSelectedTrigger(null);
          }}
        />
      )}
    </div>
  );
}

export default EmailTriggerList;