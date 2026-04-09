// components/courses/CourseOfferCapacityBadge.js
import React from 'react';
import { Users, AlertTriangle, CheckCircle } from 'lucide-react';

/**
 * Displays offer capacity for a course.
 * @param {number|null} maxOffers       - null = unlimited
 * @param {number}      offerCount      - current number of offers
 * @param {number|null} offersRemaining - null = unlimited
 * @param {boolean}     atCapacity      - true when no slots left
 * @param {string}      [className]
 */
export default function CourseOfferCapacityBadge({
  maxOffers,
  offerCount,
  offersRemaining,
  atCapacity,
  className = '',
}) {
  // No max set → unlimited
  if (maxOffers === null || maxOffers === undefined) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-gray-500 ${className}`}>
        <Users className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{offerCount} offered &mdash; no maximum set</span>
      </div>
    );
  }

  if (atCapacity) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 ${className}`}
      >
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          At capacity &mdash; {offerCount} / {maxOffers} offers sent
        </span>
      </div>
    );
  }

  // Colour-code by how full the course is
  const pct = maxOffers > 0 ? offerCount / maxOffers : 0;
  let colours = 'bg-green-50 border-green-200 text-green-700';
  let Icon = CheckCircle;
  if (pct >= 0.8) {
    colours = 'bg-amber-50 border-amber-200 text-amber-700';
    Icon = AlertTriangle;
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${colours} ${className}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        {offersRemaining} slot{offersRemaining === 1 ? '' : 's'} remaining &mdash; {offerCount} / {maxOffers} offered
      </span>
    </div>
  );
}