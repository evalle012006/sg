'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CourseOffer extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Course Offer belongs to Course
      CourseOffer.belongsTo(models.Course, {
        foreignKey: 'course_id',
        as: 'course'
      });

      // Course Offer belongs to Guest
      CourseOffer.belongsTo(models.Guest, {
        foreignKey: 'guest_id',
        as: 'guest'
      });

      // Course Offer belongs to User (who offered)
      CourseOffer.belongsTo(models.User, {
        foreignKey: 'offered_by',
        as: 'offeredBy'
      });
    }

    // Instance method to check if offer is still valid based on course dates and status
    isValid() {
      if (!this.course) return false;
      
      const now = new Date();
      const courseStartDate = new Date(this.course.start_date);
      const minEndDate = new Date(this.course.min_end_date);
      
      // Offer is valid if:
      // 1. Status allows for booking (offered or accepted)
      // 2. We're still in the minimum booking window
      // 3. Course hasn't started yet
      const validStatuses = ['offered', 'accepted'];
      return validStatuses.includes(this.status) && 
             now <= minEndDate && 
             now < courseStartDate;
    }

    // Instance method to check if course can still accept bookings
    canAcceptBookings() {
      if (!this.course) return false;
      
      const now = new Date();
      const minEndDate = new Date(this.course.min_end_date);
      
      // Can accept bookings until the minimum booking window closes
      // and only if status is 'offered'
      return this.status === 'offered' && now <= minEndDate;
    }

    // Instance method to check if offer can be accepted (for automated triggers)
    canBeAccepted() {
      if (!this.course) return false;
      
      const now = new Date();
      const minEndDate = new Date(this.course.min_end_date);
      const courseStartDate = new Date(this.course.start_date);
      
      // Can be accepted if:
      // 1. Status is 'offered'
      // 2. Still within booking window
      // 3. Course hasn't started
      return this.status === 'offered' && 
             now <= minEndDate && 
             now < courseStartDate;
    }

    // Instance method to check if offer can be marked as completed (for automated triggers)
    canBeCompleted() {
      if (!this.course) return false;
      
      const now = new Date();
      const courseEndDate = new Date(this.course.end_date);
      
      // Can be completed if:
      // 1. Status is 'accepted'
      // 2. Course has ended
      return this.status === 'accepted' && now >= courseEndDate;
    }

    // Static method to get valid offers for a course
    static async getValidOffersForCourse(courseId, includeStatuses = ['offered', 'accepted']) {
      return await this.findAll({
        where: {
          course_id: courseId,
          status: includeStatuses
        },
        include: [
          {
            model: sequelize.models.Course,
            as: 'course',
            where: {
              status: 'active' // Only active courses
            }
          },
          {
            model: sequelize.models.Guest,
            as: 'guest',
            attributes: ['id', 'first_name', 'last_name', 'email']
          }
        ]
      });
    }

    // Static method to check if guest already has an offer for this course
    static async hasExistingOffer(courseId, guestId, excludeStatuses = ['completed']) {
      const existingOffer = await this.findOne({
        where: {
          course_id: courseId,
          guest_id: guestId,
          status: {
            [sequelize.Sequelize.Op.notIn]: excludeStatuses
          }
        }
      });
      return !!existingOffer;
    }

    // Static method to get offer statistics for a course
    static async getCourseOfferStats(courseId) {
      const stats = await this.findAll({
        where: { course_id: courseId },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      // Initialize all statuses with 0 (removed 'available')
      const result = {
        offered: 0,
        accepted: 0,
        completed: 0,
        total: 0
      };

      // Populate actual counts
      stats.forEach(stat => {
        result[stat.status] = parseInt(stat.count);
        result.total += parseInt(stat.count);
      });

      return result;
    }

    // Static method to update offer status with validation (for automated triggers)
    static async updateOfferStatus(offerId, newStatus, userId = null) {
      const offer = await this.findByPk(offerId, {
        include: [{
          model: sequelize.models.Course,
          as: 'course'
        }]
      });

      if (!offer) {
        throw new Error('Offer not found');
      }

      // Validate status transition (removed 'available')
      const validTransitions = {
        'offered': ['accepted'],
        'accepted': ['completed'],
        'completed': [] // No further transitions
      };

      if (!validTransitions[offer.status].includes(newStatus)) {
        throw new Error(`Invalid status transition from ${offer.status} to ${newStatus}`);
      }

      // Additional validation based on new status
      switch (newStatus) {
        case 'accepted':
          if (!offer.canBeAccepted()) {
            throw new Error('Offer cannot be accepted at this time');
          }
          break;

        case 'completed':
          if (!offer.canBeCompleted()) {
            throw new Error('Offer cannot be marked as completed at this time');
          }
          break;
      }

      // Update the offer
      const updateData = { status: newStatus };
      if (userId) {
        updateData.updated_by = userId;
      }

      await offer.update(updateData);
      return offer;
    }
  }

  CourseOffer.init({
    uuid: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      defaultValue: DataTypes.UUIDV4
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'courses',
        key: 'id'
      }
    },
    guest_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'guests',
        key: 'id'
      }
    },
    offered_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    offered_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('offered', 'accepted', 'completed'),
      allowNull: false,
      defaultValue: 'offered',
      validate: {
        isIn: [['offered', 'accepted', 'completed']]
      }
    }
  }, {
    sequelize,
    modelName: 'CourseOffer',
    tableName: 'course_offers',
    underscored: true,
    indexes: [
      {
        fields: ['course_id']
      },
      {
        fields: ['guest_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['course_id', 'guest_id'],
        unique: true,
        name: 'course_offers_course_guest_unique'
      }
    ]
  });

  return CourseOffer;
};