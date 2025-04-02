
import winston, { format } from "winston"
const logger =  winston.createLogger({
    level:"info",
    format: winston.format.combine(
        format.timestamp({ format :"HH:mm:ss"}),
        format.json()
    ),
    defaultMeta :{ service: 'user-service'} ,
    transports: [
        //
        // - Write all logs with importance level of `error` or higher to `error.log`
        //   (i.e., error, fatal, but not other levels)
        //
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        //
        // - Write all logs with importance level of `info` or higher to `combined.log`
        //   (i.e., fatal, error, warn, and info, but not trace)
        //
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console(), // Log to console

    ]
})
if(process.env.NODE_ENV !== "production"){
    logger.add(
        new winston.transports.Console({
            format: winston.format.simple(),
        })
    )
}

export default logger;