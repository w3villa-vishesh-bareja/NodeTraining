import express from 'express'
import { login, register, sendEmail, sendOTP, verifyEmail, verifyOTP } from '../controllers/userController.js'
import {verifyJwt} from '../middleware/authMiddleware.js';


const router = express.Router()

router.post('/register', register);
router.post('/login', login);
router.post('/verifyEmail', verifyJwt, verifyEmail)
router.post('/sendEmail',verifyJwt,sendEmail);
router.post('/sendOTP',sendOTP);
router.post('/verifyOTP',verifyOTP)

export default router;