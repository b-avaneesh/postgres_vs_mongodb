const { Client } = require('pg');
require('dotenv').config();


let client = null;

async function getClient() {
    client = new Client({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
  });


  await client.connect();
  const res = await client.query('SELECT $1::text as connected', ['Connection to postgres successful!']);
  
  console.log(res.rows[0].connected);
  return client;
};

async function isClientUp(){

    if(!client){
        console.log("Client not connected");
        console.log("Connected to DB");

        await getClient();
    }

    return client;
}

module.exports = { 
    isClientUp,
    getClient
}