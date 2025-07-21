import { TIER } from "../config/appConstants.js";
import pool from "../config/dbService.js"
import fs from 'fs'
const nativeQueries = JSON.parse(
  fs.readFileSync(new URL('../nativequeries/nativeQueries.json', import.meta.url))
);
const errorMessagesConfig = JSON.parse(
  fs.readFileSync(new URL('../config/errorMessages.json', import.meta.url))
);
const successMessages = JSON.parse(
  fs.readFileSync(new URL('../config/successMessages.json', import.meta.url))
);

export const tierCheckHandler = async (receiverId , tierToCheck) => {
    if(receiverId){
        const [userTier]= await pool.query(nativeQueries.checkTier , [receiverId]);
        let tier;
        if(userTier[0].tier == TIER.TIER1){
            tier =1;
        }else if(userTier[0].tier == TIER.TIER2){
            tier =2;
        }else{
            tier =3;
        }
        if(tier >= tierToCheck){
            return true;
        }
        else{
            return false;
        }
    }
}