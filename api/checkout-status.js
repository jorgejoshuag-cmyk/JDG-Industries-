'use strict';
const {respond}=require('../lib/stripe.cjs');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return respond(res,405,{ready:false});
 // Merchant configuration alone cannot approve a delivery address or surcharge.
 // An authenticated JDG quote-approval workflow is required before payment.
 return respond(res,200,{ready:false,reason:'quote_required'});
};
