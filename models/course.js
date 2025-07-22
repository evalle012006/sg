'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Course extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }
  Course.init({
    uuid: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
    },
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    min_start_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    min_end_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    duration_hours: DataTypes.STRING,
    image_filename: DataTypes.STRING,
    status: DataTypes.STRING,
    holiday_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    sta_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    price_calculated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rate_snapshot: {
      type: DataTypes.JSON,
      allowNull: true,
    }
  }, {
    sequelize,
    modelName: 'Course',
    tableName: 'courses',
    underscored: true,
  });

  return Course;
};

async () => await Course.sync();