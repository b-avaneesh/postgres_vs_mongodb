const express = require('express')
const path = require('path')
require('dotenv').config({
    path : path.resolve(__dirname,'.env')
})
const router = express.Router();



router.post('/test', (req,res) =>{
    const mongo = fetch('localhost:')
})