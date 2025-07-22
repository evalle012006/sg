'use strict';
const {
  Model
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CourseRate extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Define associations here if needed
    }
  }
  
  CourseRate.init({
    category: {
      type: DataTypes.ENUM('holiday', 'sta'),
      allowNull: false,
      validate: {
        isIn: [['holiday', 'sta']]
      }
    },
    day_type: {
      type: DataTypes.ENUM('weekday', 'saturday', 'sunday', 'public_holiday'),
      allowNull: false,
      validate: {
        isIn: [['weekday', 'saturday', 'sunday', 'public_holiday']]
      }
    },
    package_name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      }
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        isDecimal: true,
        min: 0
      }
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isInt: true,
        min: 0
      }
    }
  }, {
    sequelize,
    modelName: 'CourseRate',
    tableName: 'course_rates',
    underscored: true,
    indexes: [
      {
        fields: ['category', 'day_type', 'order']
      }
    ]
  });

  return CourseRate;
};