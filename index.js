import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import helmet from 'helmet'
import passport from 'passport'
import registerRoute from './routes/registerRoute.js'
import loginRoutes from "./routes/loginRoute.js"
import googleRoutes from './routes/googleRoute.js'
import profileRoutes from './routes/profileRoute.js'
import todoRoutes from "./routes/todoRoutes.js"
import projectRoutes from "./routes/projectRoute.js"
import paymentsRoutes from './routes/payments.js'
import adminRoutes from './routes/adminRoutes.js'
import errorHandler from './middleware/errorMiddlewre.js'
import responseMiddleware from './middleware/responseMiddleware.js'
import fileUpload from 'express-fileupload'
import {verifyJwt} from './middleware/authMiddleware.js'
import cookieParser from 'cookie-parser'
// import http from 'http'
// import {Server} from 'socket.io'
// import { registerSocketHandlers } from './handler/socketHandler.js'

dotenv.config();
const app = express();

// const server = http.createServer(app);
// const io = new Server(server,{
//   cors: {
//     origin: 'http://localhost:5173', 
//     methods: ['GET', 'POST'],
//     credentials: true
//   }
// });

// registerSocketHandlers(io)

app.use(express.json());
app.use(helmet());
app.use(helmet.hsts({
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true
}));

app.use(cors({
    origin: ['https://node-frontend-test.vercel.app','http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'], 
    credentials: true, 
  }));

app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
}));
app.use(passport.initialize());

app.use('/register',registerRoute , responseMiddleware);
app.use('/login',loginRoutes , responseMiddleware);
app.use('/user',profileRoutes );
app.use('/task', todoRoutes );
app.use('/project', projectRoutes )
app.use('/',googleRoutes);
app.use('/payments', paymentsRoutes);
app.use('/admin', adminRoutes, responseMiddleware);


app.use(errorHandler);

const port = process.env.PORT||5000;

app.listen(port , ()=>{
    console.log(`server running on PORT: ${port}`)
})

export default app;