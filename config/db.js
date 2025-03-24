import mysql from "mysql2/promise";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import errorMessages from './errorMessages.json' assert {type : 'json'}


export const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "password",
  database: "node_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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
    return await jwt.sign({id,name,email},process.env.JWT_SECRET_KEY,{expiresIn: '1h'});
  }catch(err){
    console.error(`${errorMessages.TokenGenerationError}`,err.message);
  }
}

export async function verifyToken(token){
  try{
    const decoded =  await jwt.verify(token,process.env.JWT_SECRET_KEY);
    return decoded;
  }catch(err){
    console.error(`${errorMessages.TokenVerificationError}`, err.message)
    return null;
  }
}
export default pool;
