import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import passport from 'passport'
import userRoutes from './routes/userRoute.js'
import googleRoutes from './routes/googleRoute.js'
import errorHandler from './middleware/errorHandlingMiddlewre.js'
import logger from './logger/index.js'
import responseMiddleware from './middleware/apiMiddleware.js'
dotenv.config();
const app = express();
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173','*'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'], 
    credentials: true, 
    
  }));
app.use(passport.initialize());

app.use('/user',userRoutes);
app.use('/',googleRoutes);

app.use(responseMiddleware);
app.use(errorHandler);


const port = process.env.PORT||5000;
app.listen(port , ()=>{
    console.log(`server running on PORT: ${port}`)
})