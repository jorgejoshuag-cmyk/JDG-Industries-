'use strict';
const {stripe,configReady,verifyMerchant,respond}=require('../lib/stripe.cjs');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return respond(res,405,{ready:false});
 if(!configReady())return respond(res,200,{ready:false});
 try{await verifyMerchant(stripe());return respond(res,200,{ready:true})}catch{return respond(res,200,{ready:false})}
};
