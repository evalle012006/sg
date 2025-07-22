'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Section extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }

  Section.init({
    label: DataTypes.STRING,
    order: DataTypes.INTEGER,
    model_id: DataTypes.INTEGER,
    model_type: DataTypes.STRING, // 'Page' or 'Booking'
    type: DataTypes.STRING, // 'rows', '2_columns', '3_columns', '4_columns'
    orig_section_id: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Section',
    tableName: 'sections',
    underscored: true,
  });
  return Section;
};