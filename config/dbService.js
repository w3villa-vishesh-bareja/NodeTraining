import mysql from "mysql2/promise";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import errorMessages from './errorMessages.json' assert {type : 'json'}
import fs from 'fs'
import { configDotenv } from "dotenv";
configDotenv()

console.log(process.env.MYSQL_USER)
export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  port: process.env.MYSQL_PORT,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 100,
  queueLimit: 0,
  ssl:{
    required: true,
    // rejectUnauthorized: false, 
    ca: fs.readFileSync('./ca.pem').toString(),
  }
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("Database connected successfully");
    connection.release(); 
  } catch (err) {
    console.error(" Database connection failed:", err.message);
  }
}
testConnection();

export async function  hash(password){
  try{
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password,salt)
  }catch(error){
    crossOriginIsolated.error(`${errorMessages.hashingFailed}` , err)
  }
}

export async function compare(EnteredPassword , UserPassword){
  try {
    const isMatch = await bcrypt.compare(EnteredPassword, UserPassword);
    return isMatch;
  } catch (error) {
    console.error(`${errorMessages.passwordCompareFailed}`, error.message);
    return false;
  }
}

export async function genToken(id,name,email){
  try{
    return  jwt.sign({id,name,email},process.env.JWT_SECRET_KEY,{expiresIn: '1h'});
  }catch(err){
    console.error(`${errorMessages.TokenGenerationError}`,err.message);
  }
}

//for verification email
export async function genTokenForVerification(payload , expiresIn='1h'){
  try{
    return await jwt.sign(payload,process.env.JWT_SECRET_KEY,{expiresIn: expiresIn});
  }catch(err){
    console.error(`${errorMessages.TokenGenerationError}`,err.message);
  }
}


export async function verifyToken(token){
  try{
    const decoded =  jwt.verify(token,process.env.JWT_SECRET_KEY);
    console.log(decoded)
    return decoded;
  }catch(err){
    console.error(`${errorMessages.TokenVerificationError}`+ err)
    return null;
  }
}
export function generateRandomString() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < 13; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  
  return result;
}
export default pool;
