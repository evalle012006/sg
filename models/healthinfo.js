'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class HealthInfo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }
  HealthInfo.init({
    guest_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'guests', key: 'id',
      }
    },
    identify_aboriginal_torres: DataTypes.BOOLEAN,
    language: DataTypes.STRING,
    require_interpreter: DataTypes.BOOLEAN,
    cultural_beliefs: DataTypes.STRING,
    emergency_name: DataTypes.STRING,
    emergency_mobile_number: DataTypes.STRING,
    emergency_email: DataTypes.STRING,
    emergency_relationship: DataTypes.STRING,
    specialist_name: DataTypes.STRING,
    specialist_mobile_number: DataTypes.STRING,
    specialist_practice_name: DataTypes.STRING,
    sci_year: DataTypes.STRING,
    sci_level_asia: DataTypes.STRING,
    sci_intial_spinal_rehab: DataTypes.STRING,
    sci_type: DataTypes.STRING,
    sci_type_level: DataTypes.JSON,
    sci_inpatient: DataTypes.BOOLEAN,
    sci_injury_type: DataTypes.STRING,
    sci_other_details: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'HealthInfo',
    tableName: 'health_info',
    underscored: true,
  });

  return HealthInfo;
};

async () => await HealthInfo.sync();