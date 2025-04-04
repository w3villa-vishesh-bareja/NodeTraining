import express from 'express'
import { login, register, sendEmail, sendOTP, verifyEmail, verifyOTP } from '../controllers/userController.js'
import {verifyJwt} from '../middleware/authMiddleware.js';
import { emailVerification, registerEmail, storePassword } from '../controllers/registerController.js';


const router = express.Router()

router.post('/register', registerEmail);
router.post('/login', login);
router.post('/verifyEmail', verifyJwt, emailVerification)
router.post('/sendEmail',verifyJwt,sendEmail);
router.post('/sendOTP',sendOTP);
router.post('/verifyOTP',verifyOTP);
router.post('/setPass',storePassword);

export default router;