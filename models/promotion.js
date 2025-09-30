'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Promotion extends Model {
    static associate(models) {
      // Define associations here if needed
    }
  }
  
  Promotion.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    availability: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Display text for availability period'
    },
    terms: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Terms and conditions for the promotion'
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    image_filename: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Filename of promotion image in storage'
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'archived'),
      defaultValue: 'draft',
      allowNull: false
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Display order'
    }
  }, {
    sequelize,
    modelName: 'Promotion',
    tableName: 'promotions',
    timestamps: true,
    underscored: true
  });
  
  return Promotion;
};