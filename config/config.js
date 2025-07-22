require('dotenv').config();

module.exports = {
  "development": {
    "username": process.env.DB_USERNAME,
    "password": process.env.DB_PASSWORD,
    "database": process.env.DB_DATABASE,
    "port": process.env.DB_PORT || 3306,
    "host": process.env.DB_HOST,
    "dialect": "mysql",
    "dialectOptions":{
      "connectTimeout": 5000,
    },
    "pool": {
      "max": 25,
      "min": 0,
      "idle": 5000,
      "evict": 10000
    }
  },
  "test": {
    "username": process.env.TESTDB_USERNAME,
    "password": process.env.TESTDB_PASSWORD,
    "database": process.env.TESTDB_DATABASE,
    "port": process.env.TESTDB_PORT || 3306,
    "host": "127.0.0.1",
    "dialect": "mysql",
    "dialectOptions":{
      "connectTimeout": 5000,
    },
    "pool": {
      "max": 25,
      "min": 0,
      "idle": 5000,
      "evict": 10000
      }
  },
  "production": {
    "username": process.env.DB_USERNAME,
    "password": process.env.DB_PASSWORD,
    "database": process.env.DB_DATABASE,
    "host": process.env.DB_HOST,
    "port": process.env.DB_PORT || 3306,
    "dialect": "mysql",
    "dialectOptions":{
      "connectTimeout": 5000,
    },
    "pool": {
      "max": 25,
      "min": 0,
      "idle": 5000,
      "evict": 10000
    }
  }
}