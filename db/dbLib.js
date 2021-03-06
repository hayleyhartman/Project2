const { selectSomeWhere, selectSomeJoin, insertOne, updateOne, deleteOne } = require('./orm')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const bcrypt = require('bcrypt')
const saltRounds = 10




const dbLib = (() => {

  // jwt params
  const options = { expiresIn: '2d', issuer: 'https://dynamic-portfolio-tool.herokuapp.com' }
  const secret = process.env.JWT_SECRET

  const verifyToken = (userName, token) => {    
    const result = jwt.verify(token, secret, options)
    if (userName !== result.user) throw {
      code: 403,
      message: `You do not have access to this user page.`
    }
    return result
  }


  const checkUserName = name => {
    return selectSomeWhere('users', 'username', name, ['username'])
    .then(data => !data.length)
  }

  const checkPortfolioName = name => {
    return selectSomeWhere('portfolios', 'name', name, ['name'])
    .then(data => !data.length)
  }

  const authUser = loginObject => {
    let { userName, password } = loginObject
    
    return selectSomeWhere('users', 'username', userName, ['username', 'pw', 'id'])
    .then(data => {
      if (data.length === 0) return {
        code: 404,
        message: `The username '${userName}' is incorrect.`,
        auth: false
      }

      return bcrypt.compare(password, data[0].pw)
        .then(valid => {
          if (!valid) return {
            code: 403,
            message: 'The password you entered is incorrect.',
            auth: false
          }
          const token = jwt.sign({ user: userName }, secret, options)
          return {
            code: 200,
            auth: true,
            token,
            userName,
            usersid: data[0].id
          }
        })
    })
  }

  const getUserId = name => {
    return selectSomeWhere('users', 'username', name, ['id'])
      .then(data => data[0].id)
  }

  // takes a user name, and returns relevant information for their user info page
  const userPageFunction = (name, token) => {
    // Grab the corresponding userID, to be used in Promise.all 
    return selectSomeWhere('users', 'username', name, ['id', 'username'])
    .then(data => {
      if (data.length === 0) throw {
        code: 500,
        message: `No such user '${name}' found.`
      }
      // grab the user name requested, verify that it corresponds to the token, else throw an error
      const userName = data[0].username
      verifyToken(userName, token)
      const id = data[0].id
      // make two DB calls, one for user info and one for portfolio info
      return Promise.all([
        selectSomeWhere('users', 'id', id, ['id', 'username','email', 'userimage', 'location', 'firstname', 'lastname', 'linkedin', 'usergithuburl', 'userbio']),
        selectSomeWhere('portfolios', 'usersid', id, ['id', 'description', 'name', 'template'])
      ])
    })
    // parse the user info and portfolio info into a single object
    .then(userData => {
      const user = userData[0][0]
      
      const portfolioArray = userData[1].length === 0 ? [] : userData[1]
      return {
        userName: user.username,
        userId: user.id,
        userEmail: user.email,
        userLocation: user.location,
        userImage: user.userimage,
        firstname: user.firstname,
        lastname: user.lastname,
        linkedin: user.linkedin,
        githuburl: user.usergithuburl,
        userPortfolios: portfolioArray,
        userBio: user.userbio
      }
    })
  }

  // takes a portfolio name, and return relevant information needed to render the page. Can also be used on a User Dashboard page
  const portfolioPageFunction = name => {
    return selectSomeWhere('portfolios', 'name', name, ['id'])
    .then(data => {
      if (data.length === 0) throw new Error(`500: No such portfolio '${name}' found.`)
      const id = data[0].id
      return selectSomeJoin('portfolios', 'projects', ['config', 'name', 'public', 'template'], ['id', 'imageurl', 'githuburl', 'description', 'liveurl', 'projectname'], 'portfolios.id', 'projects.portfolioid', 'portfolios.id', id)
    })
    .then(results => {
      return selectSomeWhere('portfolios', 'name', name, ['description', 'usersid'])
        .then(desc => {
          return results.map(item => {
            const portfolioDescription = desc[0].description
            const usersid = desc[0].usersid
            return {
              ...item,
              portfolioDescription,
              usersid
            }
          })
        })
    })
    .then(results => {
      const id = results[0].usersid
      return selectSomeWhere('users', 'id', id, ['username', 'email', 'userimage', 'location', 'usergithuburl', 'linkedin', 'firstname', 'lastname', 'userbio'])
        .then(userInfo => {
          return {
            userInfo,
            portfolioInfo: results
          }
        })
    })
  }
  // adds a new user to the database, takes a user object with the following keys: 
  // userName, email, pw, preferences (JSON), location (optional), userImage (optional)
  // returns confirmation message
  const addNewUser = user => {
    const { location = null, userImage = null, linkedin = null, usergithuburl = null, userbio = null, pw, userName, email, firstname, lastname } = user
    const preferences = JSON.stringify(user.preferences)
    return bcrypt.hash(pw, saltRounds)
      .then(hash => {
        return insertOne('users', 
                        ['username', 'email', 'pw', 'preferences', 'location', 'userimage', 'firstname', 'lastname', 'linkedin', 'usergithuburl', 'userbio'], 
                        [userName, email, hash, preferences, location, userImage, firstname, lastname, linkedin, usergithuburl, userbio])
        .then(results => {
          if (results.affectedRows === 0) throw new Error(`500: User '${userName}' not added.`)
          return results
        })
      })

  }

  // updates user information, takes a user object with two keys: userName and updates.
  // updates should be an object with key/value pairs corresponding to column names/values to be updated
  // returns confirmation message
  const updateUser = ({ userName, updates, token }) => {
    verifyToken(userName, token)
    return updateOne('users', updates, `username = '${userName}'`)
    .then(results => {
      if (results.affectedRows === 0) throw new Error('500: No rows updated.')
      return results
    })
  }
  
  const addNewPortfolio = ({ technologies, description, usersid, config, portfolioName, token, userName, template }) => {
    verifyToken(userName, token)
    let configJSON = JSON.stringify(config)
    let techJSON = JSON.stringify(technologies)
    if (portfolioName.length > 20) {
      throw new Error('500: Portfolio name exceeds length (20 characters maximum')
    }
    return insertOne('portfolios', ['technologies', 'description', 'usersid', 'config', 'name', 'template'], [techJSON, description, usersid, configJSON, portfolioName, template])
    .then(results => {
      if (results.affectedRows === 0) throw new Error('500: Portfolio not added.')
      return results
    })
  }

  const updatePortfolio = ({ portfolioName, updates, token, userName }) => {
    verifyToken(userName, token)
    return updateOne('portfolios', updates, `name = '${portfolioName}'`)
    .then(results => {
      if (results.affectedRows === 0) throw new Error('500: No rows updated.')
      return results
    })
  }

  const addNewProject = ({ imageurl, githuburl, description, usersid, portfolioid, userName, token, liveurl, projectname }) => {
    verifyToken(userName, token)
    return insertOne('projects', ['imageurl', 'githuburl', 'description', 'usersid', 'portfolioid', 'liveurl', 'projectname'], [imageurl, githuburl, description, usersid, portfolioid, liveurl, projectname])
    .then(results => {
      if (results.affectedRows === 0) throw new Error('500: Project not added.')
      return results
    })
  }

  const updateProject = ({ projectId, updates, userName, token }) => {
    verifyToken(userName, token)
    return updateOne('projects', updates, `id = '${projectId}'`)
    .then(results => {
      if (results.affectedRows === 0) throw new Error('500: No rows updated.')
      return results
    })
  }

  const deleteUser = ({ userName, token }) => {
    verifyToken(userName, token)
    return deleteOne('users', `username = '${userName}'`)
    .then(results => {
      if (results.affectedRows === 0) throw new Error('500: No user deleted.')
      return results
    })
  }

  const deletePortfolio = ({ userName, portfolioName, token }) => {
    verifyToken(userName, token)
    return deleteOne('portfolios', `name = '${portfolioName}'`)
    .then(results => {
      if (results.affectedRows === 0) throw new Error('500: No portfolio deleted.')
      return results
    })
  }

  const deleteProject = ({ userName, token, projectId }) => {
    verifyToken(userName, token)
    return deleteOne('projects', `id = '${projectId}'`)
    .then(results => {
      if (results.affectedRows === 0) throw new Error('500: No portfolio deleted.')
      return results
    })
  }





  // Handles errors that are thrown by MySQL. Stick this in the catch block to 'translate' them
  // const dbErrorHandler = error => {
  //   const errorInfo = {
  //     1062: 'Sorry, this name is already taken, please choose another.',
  //     1048: 'Missing information, ensure all fields are filled out.',
  //     1452: 'The parent user or portfolio in question does not exist.'
  //   }
  //   let message = errorInfo[error.errno] || `Undocumented error code ${error.errno || error}`
  //   console.log(message)
  // }


  // public methods
  return {
    getUserId,
    checkUserName,
    checkPortfolioName,
    userPageFunction,
    portfolioPageFunction,
    addNewUser,
    updateUser,
    addNewPortfolio,
    updatePortfolio,
    addNewProject,
    updateProject,
    // dbErrorHandler,
    deleteUser,
    deletePortfolio,
    deleteProject,
    authUser,
  }
})()

module.exports = dbLib

