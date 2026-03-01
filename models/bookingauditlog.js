'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BookingAuditLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Association with Booking
      BookingAuditLog.belongsTo(models.Booking, {
        foreignKey: 'booking_id',
        as: 'booking'
      });

      // Association with User (for admin actions)
      BookingAuditLog.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });

      // ⭐ NEW: Association with Guest (for guest actions)
      BookingAuditLog.belongsTo(models.Guest, {
        foreignKey: 'guest_id',
        as: 'guest'
      });
    }

    /**
     * Get formatted user display name
     * ⭐ UPDATED: Now handles both User and Guest
     */
    getUserDisplay() {
      // Check for User (admin)
      if (this.user) {
        return `${this.user.first_name} ${this.user.last_name}`;
      }
      
      // ⭐ NEW: Check for Guest
      if (this.guest) {
        return `${this.guest.first_name} ${this.guest.last_name}`;
      }
      
      // System or unknown
      if (this.user_type === 'system') {
        return 'System';
      }
      
      return 'Unknown User';
    }

    /**
     * Get human-readable description of the change
     */
    getFormattedDescription() {
      const { action_type, old_value, new_value } = this;
      
      switch (action_type) {
        case 'dates_changed':
          if (old_value && new_value) {
            return `Booking Dates of Stay Changed. ~~${old_value.check_in} - ${old_value.check_out}~~ → ${new_value.check_in} - ${new_value.check_out}`;
          }
          break;
        
        case 'care_hours_changed':
          if (old_value && new_value) {
            return `Care Hours Changed. ~~${old_value.hours} hours~~ → ${new_value.hours} hours`;
          }
          break;
        
        case 'status_changed':
          if (old_value && new_value) {
            return `Status Changed. ~~${old_value.status}~~ → ${new_value.status}`;
          }
          break;
        
        // Add more specific formatters as needed
      }
      
      return this.description;
    }
  }

  BookingAuditLog.init({
    booking_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'bookings',
        key: 'id'
      }
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,  // Nullable - only for admin actions
      references: {
        model: 'users',
        key: 'id'
      }
    },
    // ⭐ NEW: guest_id field
    guest_id: {
      type: DataTypes.INTEGER,
      allowNull: true,  // Nullable - only for guest actions
      references: {
        model: 'guests',
        key: 'id'
      }
    },
    action_type: {
      type: DataTypes.ENUM(
        'booking_created',
        'booking_submitted',
        'booking_approved',
        'booking_rejected',
        'booking_cancelled',
        'dates_changed',
        'guest_details_changed',
        'accommodation_changed',
        'care_hours_changed',
        'funding_changed',
        'equipment_changed',
        'courses_changed',
        'dietary_requirements_changed',
        'admin_note_added',
        'amendment_submitted',
        'amendment_approved',
        'status_changed',
        'other'
      ),
      allowNull: false
    },
    user_type: {
      type: DataTypes.ENUM('guest', 'admin', 'system'),
      allowNull: false,
      defaultValue: 'system'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    old_value: {
      type: DataTypes.JSON,
      allowNull: true
    },
    new_value: {
      type: DataTypes.JSON,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true
    },
    is_internal_note: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'BookingAuditLog',
    tableName: 'booking_audit_logs',
    underscored: true,
    timestamps: true
  });

  return BookingAuditLog;
};