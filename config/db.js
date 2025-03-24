import mysql from "mysql2/promise";
import bcrypt from 'bcrypt';

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
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password,salt)
}

export async function compare(EnteredPassword , UserPassword){
  try {
    const isMatch = await bcrypt.compare(EnteredPassword, UserPassword);
    return isMatch;
  } catch (error) {
    console.error('Error comparing passwords:', error.message);
    return false;
  }
}
export default pool;
