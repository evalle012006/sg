'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class RoomType extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  RoomType.init({
    type: DataTypes.STRING,
    name: DataTypes.STRING,
    ergonomic_king_beds: DataTypes.INTEGER,
    king_single_beds: DataTypes.INTEGER,
    queen_sofa_beds: DataTypes.INTEGER,
    bedrooms: DataTypes.INTEGER,
    bathrooms: DataTypes.INTEGER,
    ocean_view: DataTypes.INTEGER,
    max_guests: DataTypes.INTEGER,
    price_per_night: DataTypes.FLOAT,
    image_filename: DataTypes.STRING,
    peak_rate: DataTypes.FLOAT,
    hsp_pricing: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: 0
    },
  }, {
    sequelize,
    modelName: 'RoomType',
    tableName: 'room_types',
    underscored: true,
  });
  return RoomType;
};