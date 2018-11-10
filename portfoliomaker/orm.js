const connection = require('./connection.js')

const orm = (() => {

  const questions = num => Array(num).fill('?').toString();

  const sqlVals = object => {
      let arrPairs = Object.entries(object)
      return arrPairs.map(x => `${x[0]} = '${x[1]}'`).join(', ');
  }

  const selectAll = table => {
      return new Promise((resolve, reject) => {
          let queryString = `SELECT * FROM ${table};`;
          connection.query(queryString, (err, res) => {
              if (err) throw err;
              resolve(res)
          })
      })
  }

  const selectSome = (table, ...cols) => {
    return new Promise((resolve, reject) => {
        let colList = cols.join(', ')
        let queryString = `SELECT ${colList} FROM ${table}`
        connection.query(queryString, (err, res) => {
          if (err) throw err
          resolve(res)
        })
      }
    )
  }

  const insertOne = (table, cols, vals) => {
      return new Promise((resolve, reject) => {
          let queryString = `INSERT INTO ${table} (${cols.toString()}) VALUES (${questions(vals.length)});`;
          console.log(queryString)
          connection.query(queryString, vals, (err, res) => {
              if (err) throw err;
              resolve(res);
          })
      })
  }

  const updateOne = (table, vals, condition) => {
      return new Promise((resolve, reject) => {
          let queryString = `UPDATE ${table} SET ${sqlVals(vals)} WHERE ${condition};`;
          connection.query(queryString, (err, res) => {
              if (err) throw err;
              resolve(res);
          })
      })
  }

  return {
    selectAll,
    selectSome,
    insertOne,
    updateOne
  }

})()


module.exports = orm;
