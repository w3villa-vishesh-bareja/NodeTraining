import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import userRoutes from './routes/userRoute.js'

dotenv.config();
const app = express();
app.use(express.json());

app.use('/user',userRoutes);

const port = process.env.PORT||8080;
app.listen(port , ()=>{
    console.log(`server running on PORT: ${port}`)
})