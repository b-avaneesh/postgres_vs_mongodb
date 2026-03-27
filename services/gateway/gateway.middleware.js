const path = require('path')
const async_handler = require('express-async-handler')
const proxy = require('express-http-proxy');
require('dotenv').config({
    path: path.resolve(__dirname,'.env')
})


/**
 * Controller to add patient, pings respective server proxy based on query parameter 'db'
 */
const routingMiddleware = (req, res, next) => {
    const target = req.query.db === 'mongo' 
        ? 'http://localhost:8000/' 
        : 'http://localhost:7000/';
    
    // The proxy "hijacks" the response, so it never reaches 
    // any code below this line if a target is found.
    proxy(target)(req, res, next);
};


module.exports = { 
    routingMiddleware
}