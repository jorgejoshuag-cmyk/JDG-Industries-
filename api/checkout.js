'use strict';
const {InputError,configuration,validateOrder,getStripe,send,readJson,buildLineItems}=require('../lib/payment');
function createHandler({env=process.env,stripeFactory=()=>getStripe(env)}={}){return async function(req,res){
try{
const cfg=configuration(env);
if(req.method==='GET'){
const sessionId=new URL(req.url,'https://local.invalid').searchParams.get('session_id');
if(!sessionId)return send(res,200,{checkoutEnabled:cfg.enabled,notice:cfg.enabled?cfg.notice:'Online payments are not active. Please request a confirmed quote.'});
if(!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)||!env.STRIPE_SECRET_KEY)return send(res,400,{error:'Payment could not be verified.'});
const session=await stripeFactory().checkout.sessions.retrieve(sessionId);
if(session.metadata?.source!=='jdg-web-v1')return send(res,404,{error:'Payment could not be verified.'});
return send(res,200,{paid:session.payment_status==='paid'});
}
if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return send(res,405,{error:'Method not allowed.'})}
if(!cfg.enabled)return send(res,503,{error:'Online payments are not active. Please request a confirmed quote. No payment has been taken.'});
if(req.headers.origin!==cfg.origin)throw new InputError('Request origin is not permitted.',403);
if(!(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new InputError('JSON is required.',415);
const {order,buyer:b,requestId}=validateOrder(await readJson(req),cfg),stripe=stripeFactory();
const [account,taxSettings,registrations]=await Promise.all([stripe.accounts.retrieve(),stripe.tax.settings.retrieve(),stripe.tax.registrations.list({status:'active',limit:100})]);
if(account.charges_enabled!==true||taxSettings.status!=='active'||!registrations.data.some(r=>r.country==='US'&&r.status==='active'&&r.country_options?.us?.state==='FL'))throw new InputError('Payment setup requires review. Request a confirmed quote instead.',503);
const lineItems=buildLineItems(order,cfg),address={line1:b.address,city:b.city,state:'FL',postal_code:b.zip,country:'US'};
// Check tax configuration before a customer can enter a payable checkout.
const tax=await stripe.tax.calculations.create({currency:'usd',customer_details:{address,address_source:'shipping'},line_items:lineItems.map((item,i)=>({amount:item.price_data.unit_amount*item.quantity,reference:'jdg-'+i,tax_code:item.price_data.product_data.tax_code,tax_behavior:'exclusive'}))});
if(!tax.tax_breakdown?.length||tax.tax_breakdown.some(t=>t.taxability_reason==='not_collecting'))throw new InputError('Tax calculation requires review. Request a confirmed quote instead.',503);
const customer=await stripe.customers.create({name:b.name,email:b.email,phone:b.phone,address,shipping:{name:b.name,phone:b.phone,address},metadata:{source:'jdg-web-v1'}},{idempotencyKey:'jdg-customer-'+requestId});
const metadata={source:'jdg-web-v1',request_id:requestId,requested_date:b.date,delivery_zip:b.zip,loads:String(order.loads),tons:String(order.tons),site_notes:(b.notes||'').slice(0,450)};
const session=await stripe.checkout.sessions.create({mode:'payment',customer:customer.id,line_items:lineItems,automatic_tax:{enabled:true},integration_identifier:'jdg-store-qnvrmxkt',metadata,payment_intent_data:{metadata},custom_text:{submit:{message:cfg.notice}},success_url:cfg.origin+'/?checkout=return&session_id={CHECKOUT_SESSION_ID}',cancel_url:cfg.origin+'/?checkout=cancelled'},{idempotencyKey:'jdg-checkout-'+requestId});
if(!session.url||new URL(session.url).hostname!=='checkout.stripe.com')throw new Error('Checkout URL not returned');
return send(res,200,{url:session.url});
}catch(e){if(!(e instanceof InputError))console.error('JDG_CHECKOUT_ERROR',e.type||'internal');return send(res,e instanceof InputError?e.status:502,{error:e instanceof InputError?e.message:'Secure payment is temporarily unavailable. Your cart is saved. Contact JDG before retrying.'})}
}}
module.exports=createHandler();module.exports.createHandler=createHandler;
