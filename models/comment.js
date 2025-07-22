'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Comment extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
  }
  Comment.init({
    title: DataTypes.STRING,
    message: DataTypes.TEXT,
    guest_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'guests',
        key: 'id',
      }
    },
    user_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'users',
        key: 'id',
    }
  },
  }, {
    sequelize,
    modelName: 'Comment',
    tableName: 'comments',
    underscored: true,
  });
  return Comment;
};

async () => await Comment.sync();