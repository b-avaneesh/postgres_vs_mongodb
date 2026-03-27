const express = require('express')
const path = require('path')
require('dotenv').config({
    path : path.resolve(__dirname,'.env')
})
const { routingMiddleware } = require("./gateway.middleware")
const { 
    ADD_ROUTE,
    GET_ROUTE,
    GENERATE_ROUTE,
    PATIENT,
    APPOINTMENT,
    DOCTOR,
    BILL,
    PRESCRIPTION
} = process.env;

const router = express.Router();



router.post('/test', (req,res) =>{
    const mongo = fetch('localhost:')
})

/**
 * Post operations - addition of doctor, patient, appointment, bill
 */
router.post(
    ADD_ROUTE + PATIENT, 
    routingMiddleware
)


module.exports = router;