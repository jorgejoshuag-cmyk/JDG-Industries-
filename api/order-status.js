'use strict';
const {stripe,respond}=require('../lib/stripe.cjs');
const {integration}=require('../lib/checkout.cjs');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return respond(res,405,{error:'Method not allowed.'});
 const id=req.query?.session_id;
 if(typeof id!=='string'||!/^cs_(test|live)_[A-Za-z0-9]{20,220}$/.test(id))return respond(res,400,{error:'Invalid order reference.'});
 try{
  const session=await stripe().checkout.sessions.retrieve(id);
  if(session.metadata?.integration!==integration)return respond(res,404,{error:'Order not found.'});
  if(process.env.VERCEL_ENV==='production'&&!session.livemode)return respond(res,404,{error:'Order not found.'});
  // Status display only. No writes, fulfillment or customer PII are returned here.
  return respond(res,200,{paid:session.payment_status==='paid',status:session.status,reference:session.client_reference_id});
 }catch{return respond(res,503,{error:'We could not verify payment status. Please contact JDG before paying again.'})}
};
