import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { toast } from 'react-toastify';
import moment from 'moment';

const TabButton = dynamic(() => import('../../components/ui-v2/TabButton'));
const Button = dynamic(() => import('../ui-v2/Button'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));

export default function GuestCourses({ guest, readOnly = false }) {
  // State management
  const [selectedCourseTab, setSelectedCourseTab] = useState("all-courses");
  const [courseOffers, setCourseOffers] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal states
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedCourseToRemove, setSelectedCourseToRemove] = useState(null);
  const [selectedCoursesToOffer, setSelectedCoursesToOffer] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Load data when guest changes
  useEffect(() => {
    if (guest?.id) {
      loadCourseOffers();
      if (!readOnly) {
        loadAvailableCourses();
      }
    }
  }, [guest?.id, readOnly]);

  // API calls
  const loadCourseOffers = async () => {
    if (!guest?.id) return;
    
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        guest_id: guest.id.toString(),
        include_invalid: 'true',
        limit: '100'
      });
      
      const response = await fetch(`/api/courses/offers?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to load offers: ${response.status}`);
      }
      
      const result = await response.json();
      if (result.success) {
        setCourseOffers(result.data || []);
      } else {
        throw new Error(result.message || 'Failed to load course offers');
      }
    } catch (error) {
      console.error('Error loading course offers:', error);
      toast.error('Failed to load course offers');
      setCourseOffers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableCourses = async () => {
    try {
      const response = await fetch('/api/courses/');
      if (!response.ok) {
        throw new Error(`Failed to load courses: ${response.status}`);
      }
      
      const result = await response.json();
      const coursesData = result.courses || result.data || result || [];
      const activeCourses = coursesData.filter(course => course.status === 'active');
      
      setAvailableCourses(activeCourses);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error('Failed to load available courses');
      setAvailableCourses([]);
    }
  };

  // Process course offers with computed statuses
  const processedOffers = useMemo(() => {
    return courseOffers.map(offer => {
      const now = moment();
      const courseStart = moment(offer.course?.start_date);
      const courseEnd = moment(offer.course?.end_date);
      const bookingDeadline = moment(offer.course?.min_end_date);
      
      let computedStatus = offer.status;
      
      // Determine dynamic "Upcoming" status - only for accepted courses
      if (offer.status === 'accepted' && 
          courseStart.isAfter(now) && 
          now.isBefore(bookingDeadline)) {
        computedStatus = 'upcoming';
      }
      
      return {
        ...offer,
        computedStatus,
        courseName: offer.course?.title || 'Unknown Course',
        courseImage: offer.course?.imageUrl || '/course-placeholder.jpg',
        courseDates: offer.course ? 
          `${moment(offer.course.start_date).format('DD MMM, YYYY')} - ${moment(offer.course.end_date).format('DD MMM, YYYY')}` : 
          'Dates TBD',
        duration: offer.course?.duration_hours ? `(${offer.course.duration_hours} hours)` : '',
        isExpired: now.isAfter(bookingDeadline),
        canRemove: !readOnly && ['offered', 'accepted'].includes(offer.status) && !now.isAfter(courseStart)
      };
    });
  }, [courseOffers, readOnly]);

  // Get status counts for tabs
  const statusCounts = useMemo(() => {
    return {
      all: processedOffers.length,
      offered: processedOffers.filter(o => o.status === 'offered' && o.computedStatus !== 'upcoming').length,
      accepted: processedOffers.filter(o => o.status === 'accepted' && o.computedStatus !== 'upcoming').length,
      upcoming: processedOffers.filter(o => o.computedStatus === 'upcoming').length,
      completed: processedOffers.filter(o => o.status === 'completed').length
    };
  }, [processedOffers]);

  // Course sub-tabs configuration
  const courseTabs = [
    { label: `ALL (${statusCounts.all})`, size: "small" },
    { label: `OFFERED (${statusCounts.offered})`, size: "small" },
    { label: `ACCEPTED (${statusCounts.accepted})`, size: "small" },
    { label: `UPCOMING (${statusCounts.upcoming})`, size: "small" },
    { label: `COMPLETED (${statusCounts.completed})`, size: "small" }
  ];

  // Filter courses based on selected tab
  const getFilteredCourses = () => {
    switch (selectedCourseTab) {
      case "offered":
        return processedOffers.filter(offer => offer.status === 'offered' && offer.computedStatus !== 'upcoming');
      case "accepted":
        return processedOffers.filter(offer => offer.status === 'accepted' && offer.computedStatus !== 'upcoming');
      case "upcoming":
        return processedOffers.filter(offer => offer.computedStatus === 'upcoming');
      case "completed":
        return processedOffers.filter(offer => offer.status === 'completed');
      default:
        return processedOffers;
    }
  };

  // Get status badge component
  const getStatusBadge = (offer) => {
    const status = offer.computedStatus || offer.status;
    
    // Map status to StatusBadge types
    const statusTypeMap = {
      'offered': 'offer',
      'accepted': 'pending',
      'upcoming': 'primary',
      'completed': 'success'
    };
    
    const statusLabelMap = {
      'offered': 'Offered',
      'accepted': 'Accepted',
      'upcoming': 'Upcoming', 
      'completed': 'Completed'
    };
    
    const badgeType = statusTypeMap[status] || 'offer';
    const badgeLabel = statusLabelMap[status] || status;
    
    return (
      <StatusBadge 
        type={badgeType}
        label={badgeLabel}
        size="small"
        showIcon={false}
      />
    );
  };

  // Modal handlers
  const handleOpenOfferModal = () => {
    setSelectedCoursesToOffer([]);
    setSearchTerm('');
    setShowOfferModal(true);
  };

  const handleCloseOfferModal = () => {
    setShowOfferModal(false);
    setSelectedCoursesToOffer([]);
    setSearchTerm('');
  };

  const handleOpenRemoveModal = (offer) => {
    setSelectedCourseToRemove(offer);
    setShowRemoveModal(true);
  };

  const handleCloseRemoveModal = () => {
    setShowRemoveModal(false);
    setSelectedCourseToRemove(null);
  };

  // API actions
  const handleRemoveCourse = async () => {
    if (!selectedCourseToRemove) return;
    
    try {
      const response = await fetch(`/api/courses/offers/${selectedCourseToRemove.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove course offer');
      }
      
      const result = await response.json();
      toast.success(result.message || 'Course offer removed successfully');
      loadCourseOffers();
      handleCloseRemoveModal();
    } catch (error) {
      console.error('Error removing course offer:', error);
      toast.error('Failed to remove course offer');
    }
  };

  const handleOfferCourse = async () => {
    if (selectedCoursesToOffer.length === 0) {
      toast.error('Please select at least one course to offer');
      return;
    }

    try {
      const response = await fetch('/api/courses/offers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          course_id: selectedCoursesToOffer[0],
          guest_id: guest.id,
          notes: `Offered via guest profile on ${moment().format('DD/MM/YYYY')}`,
          offered_by: null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to offer course');
      }

      const result = await response.json();
      toast.success(result.message || 'Course offered successfully');
      loadCourseOffers();
      handleCloseOfferModal();
    } catch (error) {
      console.error('Error offering course:', error);
      toast.error('Failed to offer course');
    }
  };

  // Filter available courses for offer modal
  const filteredAvailableCourses = availableCourses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase());
    const notAlreadyOffered = !courseOffers.some(offer => offer.course_id === course.id);
    return matchesSearch && notAlreadyOffered;
  });

  // Render course card
  const renderCourseCard = (offer) => (
    <div key={offer.id} className="flex flex-col sm:flex-row items-start sm:items-center p-4 border-b border-gray-200 hover:bg-gray-50 space-y-3 sm:space-y-0">
      <div className="w-full sm:w-32 h-32 sm:mr-4 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
        <Image 
          src={offer.courseImage} 
          alt={offer.courseName}
          width={128}
          height={128}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = "/course-placeholder.jpg";
          }}
        />
      </div>
      
      <div className="flex-grow w-full sm:w-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-gray-900 text-sm sm:text-base">{offer.courseName}</h3>
            {getStatusBadge(offer)}
          </div>
          <div className="flex items-center justify-end">
            {/* Only show Remove button if NOT readOnly */}
            {!readOnly && offer.canRemove && (
              <Button
                color="outline"
                size="small"
                label="REMOVE"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenRemoveModal(offer);
                }}
                className="text-xs"
              />
            )}
          </div>
        </div>
        
        <p className="text-xs sm:text-sm text-gray-600 mb-1">Minimum dates of stay</p>
        <p className="text-xs sm:text-sm text-gray-800">
          <span className="block sm:inline">{offer.courseDates}</span>
          <span className="block sm:inline sm:ml-1">{offer.duration}</span>
        </p>
        
        {offer.isExpired && (
          <p className="text-xs text-red-600 mt-1 font-medium">Booking deadline has passed</p>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {/* Course Sub-tabs with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-4 sm:space-y-0">
        <div className="flex-shrink-0">
          <TabButton
            tabs={courseTabs}
            onChange={(index) => {
              const tabNames = ["all-courses", "offered", "accepted", "upcoming", "completed"];
              setSelectedCourseTab(tabNames[index]);
            }}
            type="filled"
            borderRadius="8px"
          />
        </div>
        
        {/* Action buttons - HIDDEN for readOnly (guest users) */}
        {!readOnly && (
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <Button
              color="primary"
              size="medium"
              label="UPDATE"
              onClick={loadCourseOffers}
              className="w-full sm:w-auto"
            />
            <Button
              color="secondary"
              size="medium"
              label="+ OFFER COURSE"
              onClick={handleOpenOfferModal}
              className="w-full sm:w-auto"
            />
          </div>
        )}
      </div>

      {/* Course List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            Loading courses...
          </div>
        ) : getFilteredCourses().length > 0 ? (
          getFilteredCourses().map(offer => renderCourseCard(offer))
        ) : (
          <div className="p-8 text-center text-gray-500">
            No courses found for this filter.
          </div>
        )}
      </div>

      {/* Offer Course Modal - Only rendered if NOT readOnly */}
      {!readOnly && showOfferModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">OFFER A COURSE</h2>
                <button
                  onClick={handleCloseOfferModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Search courses..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Course List */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredAvailableCourses.length === 0 ? (
                <p className="text-center text-gray-500">No available courses found.</p>
              ) : (
                filteredAvailableCourses.map(course => {
                  const isSelected = selectedCoursesToOffer.includes(course.id);
                  return (
                    <div
                      key={course.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedCoursesToOffer([]);
                        } else {
                          setSelectedCoursesToOffer([course.id]);
                        }
                      }}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer mb-2 transition-colors ${
                        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 mr-4 flex-shrink-0">
                        <Image 
                          src={course.imageUrl || '/course-placeholder.jpg'} 
                          alt={course.title}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-grow">
                        <h4 className="font-medium text-gray-900">{course.title}</h4>
                        <p className="text-sm text-gray-600">
                          {course.start_date && course.end_date ? 
                            `${moment(course.start_date).format('DD MMM, YYYY')} - ${moment(course.end_date).format('DD MMM, YYYY')}` : 
                            'Dates TBD'
                          } {course.duration_hours ? `(${course.duration_hours} hours)` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <Button
                color="outline"
                size="medium"
                label="CANCEL"
                onClick={handleCloseOfferModal}
              />
              <Button
                color="primary"
                size="medium"
                label="ADD"
                onClick={handleOfferCourse}
                disabled={selectedCoursesToOffer.length === 0}
              />
            </div>
          </div>
        </div>
      )}

      {/* Remove Course Modal - Only rendered if NOT readOnly */}
      {!readOnly && showRemoveModal && selectedCourseToRemove && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">REMOVE COURSE</h2>
                <button
                  onClick={handleCloseRemoveModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-gray-700 mb-6">
                Are you sure you want to remove this <strong>{selectedCourseToRemove.courseName}</strong> offered course?
              </p>

              <div className="flex justify-end space-x-3">
                <Button
                  color="outline"
                  size="medium"
                  label="CANCEL"
                  onClick={handleCloseRemoveModal}
                />
                <Button
                  color="secondary"
                  size="medium"
                  label="REMOVE"
                  onClick={handleRemoveCourse}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}