import express from "express";
import pool, { hash, compare } from "../config/db.js";

export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const [existingUsers] = await pool.query(
      "SELECT id, name, email FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: "User already exists.", user: existingUsers[0] });
    }

    const hashedPassword = await hash(password);

    await pool.query("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [
      name,
      email,
      hashedPassword,
    ]);

    return res.status(201).json({ message: "User registered successfully." });
  } catch (error) {
    console.error("Error during registration:", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const [users] = await pool.query(
      "SELECT id, name, email, password FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const user = users[0];
    const isValid = await compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    return res.status(200).json({
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Error during login:", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};
