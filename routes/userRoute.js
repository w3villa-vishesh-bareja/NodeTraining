import express from 'express'
import { login, register, verifyEmail } from '../controllers/userController.js'
import {verifyJwt} from '../middleware/authMiddleware.js';


const router = express.Router()

router.post('/register', register);
router.post('/login', login);
router.post('/verifyEmail', verifyJwt, verifyEmail)

export default router;