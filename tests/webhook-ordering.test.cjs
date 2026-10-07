'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const Stripe=require('stripe');
const {integration}=require('../lib/checkout.cjs');
const response=()=>({setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}});

test('duplicate and older webhook events use current payment state and preserve the dispatch hold',async()=>{
 const names=['VERCEL_ENV','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET'];const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 process.env.VERCEL_ENV='preview';process.env.STRIPE_SECRET_KEY='sk_test_fixture';process.env.STRIPE_WEBHOOK_SECRET='whsec_fixture';
 const stripe=require('../lib/stripe.cjs').stripe(),webhook=require('../api/stripe-webhook.js');
 const retrieve=stripe.checkout.sessions.retrieve,update=stripe.paymentIntents.update;
 const session={id:'cs_test_fixture',payment_status:'paid',metadata:{integration,delivery_zip:'33027'},collected_information:{shipping_details:{address:{country:'US',state:'FL',postal_code:'33027'}}},payment_intent:{id:'pi_fixture',status:'succeeded',metadata:{dispatch_status:'hold_for_jdg_approval',terms_acknowledged:'true'},latest_charge:{outcome:{risk_level:'normal'},payment_method_details:{card:{wallet:{type:'apple_pay'}}}}}};
 let retrievals=0;const writes=[];
 stripe.checkout.sessions.retrieve=async id=>{assert.equal(id,session.id);retrievals++;return session};
 stripe.paymentIntents.update=async(id,body)=>{assert.equal(id,session.payment_intent.id);writes.push(body);Object.assign(session.payment_intent.metadata,body.metadata);return session.payment_intent};
 async function deliver(type,snapshotStatus){
  const payload=JSON.stringify({id:'evt_fixture',livemode:false,type,data:{object:{id:session.id,payment_status:snapshotStatus,metadata:{integration}}}});
  const signature=Stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
  const request=Object.assign(Readable.from([Buffer.from(payload)]),{method:'POST',headers:{'stripe-signature':signature}});const res=response();await webhook(request,res);assert.equal(res.code,200);
 }
 try{
  await deliver('checkout.session.completed','unpaid');
  await deliver('checkout.session.completed','unpaid');
  await deliver('checkout.session.async_payment_failed','unpaid');
  assert.equal(retrievals,3);assert.equal(writes.length,3);
  assert.deepEqual(writes[0],writes[1]);assert.deepEqual(writes[1],writes[2]);
  assert.equal(session.payment_intent.metadata.jdg_payment_verified,'true');
  assert.equal(session.payment_intent.metadata.dispatch_status,'hold_for_jdg_approval');assert.equal(session.payment_intent.metadata.terms_acknowledged,'true');
  for(const write of writes)assert.equal(Object.hasOwn(write.metadata,'dispatch_status'),false);
  session.payment_status='unpaid';session.payment_intent.status='processing';
  await deliver('checkout.session.async_payment_succeeded','paid');
  assert.equal(retrievals,4);assert.equal(writes.length,3);assert.equal(session.payment_intent.metadata.dispatch_status,'hold_for_jdg_approval');
 }finally{
  stripe.checkout.sessions.retrieve=retrieve;stripe.paymentIntents.update=update;
  for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name]}
 }
});
