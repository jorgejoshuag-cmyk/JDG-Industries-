'use strict';
const {getStripe,readRaw,send}=require('../lib/payment');
function createHandler({env=process.env,stripeFactory=()=>getStripe(env)}={}){return async function(req,res){
if(req.method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{error:'Method not allowed.'})}
if(!env.STRIPE_SECRET_KEY||!env.STRIPE_WEBHOOK_SECRET)return send(res,503,{error:'Webhook is not configured.'});
const stripe=stripeFactory();let event;
try{const raw=await readRaw(req,1048576);if(!raw.length)throw Error('Raw body unavailable');event=stripe.webhooks.constructEvent(raw,req.headers['stripe-signature'],env.STRIPE_WEBHOOK_SECRET)}catch{return send(res,400,{error:'Invalid webhook signature.'})}
if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(event.type))return send(res,200,{received:true});
try{
const session=await stripe.checkout.sessions.retrieve(event.data.object.id);
if(session.metadata?.source!=='jdg-web-v1')return send(res,200,{received:true});
// Persist payment reconciliation in Stripe, never reserve a truck from a redirect.
if(session.payment_status==='paid'&&session.payment_intent){
const pi=await stripe.paymentIntents.retrieve(session.payment_intent);
if(pi.metadata?.jdg_payment_verified!=='true')await stripe.paymentIntents.update(session.payment_intent,{metadata:{jdg_payment_verified:'true',jdg_order_status:'paid_pending_dispatch',checkout_session:session.id}},{idempotencyKey:'jdg-paid-'+session.id});
}else if(event.type==='checkout.session.async_payment_failed'&&session.payment_intent){
const pi=await stripe.paymentIntents.retrieve(session.payment_intent);
if(pi.metadata?.jdg_payment_verified!=='true')await stripe.paymentIntents.update(session.payment_intent,{metadata:{jdg_order_status:'payment_failed'}},{idempotencyKey:'jdg-failed-'+event.id});
}
return send(res,200,{received:true});
}catch(e){console.error('JDG_WEBHOOK_ERROR',e.type||'internal');return send(res,500,{error:'Retry webhook delivery.'})}
}}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.config={api:{bodyParser:false}};
