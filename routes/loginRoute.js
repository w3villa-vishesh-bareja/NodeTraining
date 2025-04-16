import express from 'express';
import { login } from '../controllers/userController.js';
import limiter from '../config/rateLimiter.js';

const router = express.Router();

router.post('/' , limiter ,login);

export default router;