'use strict';
const {stripe,respond}=require('../lib/stripe.cjs');
const {integration}=require('../lib/checkout.cjs');
module.exports=async(req,res)=>{
 if(req.method!=='POST')return respond(res,405,{error:'Method not allowed.'});
 if(!process.env.STRIPE_WEBHOOK_SECRET)return respond(res,503,{error:'Webhook not configured.'});
 let event,s;
 try{
  s=stripe();const chunks=[];let bytes=0;
  for await(const chunk of req){bytes+=chunk.length;if(bytes>1048576)return respond(res,413,{error:'Payload too large.'});chunks.push(Buffer.from(chunk))}
  event=s.webhooks.constructEvent(Buffer.concat(chunks),req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);
 }catch{return respond(res,400,{error:'Invalid webhook.'})}
 if(event.livemode!==(process.env.VERCEL_ENV==='production'))return respond(res,400,{error:'Wrong environment.'});
 if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed'].includes(event.type))return respond(res,200,{received:true});
 if(event.data.object.metadata?.integration!==integration)return respond(res,200,{received:true});
 try{
  // Retrieve current state to tolerate duplicate and out-of-order events.
  const session=await s.checkout.sessions.retrieve(event.data.object.id,{expand:['payment_intent.latest_charge']});
  if(session.metadata?.integration!==integration)return respond(res,200,{received:true});
  const pi=session.payment_intent;if(!pi || typeof pi==='string')return respond(res,200,{received:true});
  if(session.payment_status==='paid'&&pi.status==='succeeded'){
   const charge=pi.latest_charge;const card=charge?.payment_method_details?.card;
   const address=session.collected_information?.shipping_details?.address || session.shipping_details?.address;
   const matches=address?.country==='US'&&address?.state==='FL'&&address?.postal_code?.slice(0,5)===session.metadata.delivery_zip;
   const flags=[];
   if(!matches)flags.push('delivery_address_requires_review');
   if(charge?.outcome?.risk_level && charge.outcome.risk_level!=='normal')flags.push('risk_'+charge.outcome.risk_level);
   if(card?.checks?.cvc_check==='fail'||card?.checks?.address_postal_code_check==='fail'||card?.checks?.address_line1_check==='fail')flags.push('card_verification_failed');
   // Authentication data is evidence to review, never a guarantee of liability shift.
   const auth=card?.three_d_secure?.result || (card?.wallet?.type ? 'wallet_'+card.wallet.type : 'not_reported');
   await s.paymentIntents.update(pi.id,{metadata:{jdg_payment_verified:'true',jdg_checkout_session:session.id,jdg_authentication:auth,jdg_review_flags:flags.join(',')||'manual_order_review_required'}});
   // dispatch_status was set to hold at creation and is NEVER released here.
  }
  return respond(res,200,{received:true});
 }catch{console.error('JDG webhook retry required');return respond(res,500,{error:'Please retry.'})}
};
module.exports.config={api:{bodyParser:false}};
