'use strict';
const {ORIGIN,validateOrder,quoteRequired}=require('../lib/checkout.cjs');
const {appOrigin,configReady,respond}=require('../lib/stripe.cjs');
module.exports=async(req,res)=>{
 if(req.method!=='POST'){res.setHeader('Allow','POST');return respond(res,405,{error:'Method not allowed.'})}
 if(!(process.env.VERCEL_ENV==='preview'?[appOrigin()]:[ORIGIN,'https://jdgindustries.com']).includes(req.headers.origin))return respond(res,403,{error:'Please start checkout from JDGIndustries.com.'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return respond(res,415,{error:'Invalid request format.'});
 if(Number(req.headers['content-length']||0)>20000)return respond(res,413,{error:'Order is too large.'});
 try{
  if(!configReady())return respond(res,503,{error:'Online payment is not available yet. Your cart is saved; request a quote or call (954) 218-2906.'});
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  if(JSON.stringify(body).length>20000)return respond(res,413,{error:'Order is too large.'});
  validateOrder(body);
  // There is no authenticated JDG quote-approval store yet. County, ZIP,
  // customer flags and browser-supplied plans cannot approve a jobsite.
  // Keep every order quote-first, even if merchant configuration is complete.
  throw quoteRequired();
 }catch(error){
  if(error instanceof SyntaxError)return respond(res,400,{error:'Invalid order. Please try again.'});
  if(error.status===400)return respond(res,400,{error:error.message});
  if(error.code==='quote_required')return respond(res,409,{code:error.code,error:error.message});
  // Never log bodies, customer details, URLs containing session IDs, or Stripe secrets.
  console.error('JDG checkout unavailable',{type:error.type||'configuration',code:error.code||'unavailable'});
  return respond(res,503,{error:'Online payment is temporarily unavailable. No payment was taken here. Keep your cart and request a quote or call (954) 218-2906.'});
 }
};
