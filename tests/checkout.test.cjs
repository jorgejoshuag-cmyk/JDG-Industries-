'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const Stripe=require('stripe');
const {catalog,validateOrder,buildSession,integration,ORIGIN}=require('../lib/checkout.cjs');
const base=()=>({items:[{material:0,tons:22}],county:'Broward',zip:'33027',requestId:'11111111-2222-4333-8444-555555555555',accepted:true});
const codes={material:'txcd_fixture',delivery:'txcd_fixture',fuel:'txcd_fixture'};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}});
test('server uses published prices and charges delivery per load, ignoring injected prices',()=>{
 const input=base();input.items=[{material:0,tons:22,price:1},{material:8,tons:11,price:0}];
 const order=validateOrder(input),{parameters:p}=buildSession(order,codes);
 assert.equal(p.line_items.reduce((s,l)=>s+l.price_data.unit_amount*l.quantity,0),132600);
 assert.equal(p.line_items.length,6);assert.equal(p.line_items[3].price_data.unit_amount,19800);
 assert.equal(p.metadata.dispatch_status,'hold_for_jdg_approval');assert.equal(p.payment_intent_data.metadata.dispatch_status,'hold_for_jdg_approval');
 assert.equal(p.payment_method_options.card.request_three_d_secure,'any');assert.equal(p.payment_method_types,undefined);assert.equal(p.automatic_tax.enabled,true);
});
test('invalid loads, service areas and missing acknowledgment are rejected',()=>{
 for(const tons of [0,-1,22.5,.6,Infinity,'22',NaN])assert.throws(()=>validateOrder({...base(),items:[{material:0,tons}]}));
 for(const material of [-1,9,'0',.5])assert.throws(()=>validateOrder({...base(),items:[{material,tons:22}]}));
 for(const patch of [{items:[]},{items:Array(31).fill({material:0,tons:22})},{county:'Orange'},{zip:'12345'},{accepted:false},{date:'2026-02-30'},{requestId:'x'}])assert.throws(()=>validateOrder({...base(),...patch}));
});
test('idempotency stays stable on retry and changes when the order changes',()=>{
 const a=buildSession(validateOrder(base()),codes),b=buildSession(validateOrder(base()),codes);
 assert.equal(a.idempotencyKey,b.idempotencyKey);
 assert.notEqual(a.idempotencyKey,buildSession(validateOrder({...base(),zip:'33301'}),codes).idempotencyKey);
});
test('catalog matches the currently published frontend',()=>{
 const html=require('node:fs').readFileSync('index.html','utf8');
 const products=JSON.parse(html.match(/const products=(\[.*?\]);/s)[1]);
 assert.deepEqual(products.map(p=>[p.name,p.price*100]),catalog);
});
test('production checkout fails closed with missing configuration',async()=>{
 delete process.env.CHECKOUT_ENABLED;
 const res=response();await require('../api/checkout.js')({method:'POST',headers:{origin:ORIGIN,'content-type':'application/json'},body:base()},res);
 assert.equal(res.code,503);
 const state=response();await require('../api/checkout-status.js')({method:'GET'},state);assert.equal(state.body.ready,false);
});
test('foreign-origin and oversized requests are rejected',async()=>{
 for(const [headers,expected] of [[{origin:'https://evil.example','content-type':'application/json'},403],[{origin:ORIGIN,'content-type':'application/json','content-length':'20001'},413]]){
 const res=response();await require('../api/checkout.js')({method:'POST',headers,body:base()},res);assert.equal(res.code,expected)
 }
});
test('webhook rejects forged signatures and confirms payment without releasing dispatch',async()=>{
 process.env.STRIPE_SECRET_KEY='sk_test_unit_fixture';process.env.STRIPE_WEBHOOK_SECRET='whsec_unit_fixture';
 const s=require('../lib/stripe.cjs').stripe();const webhook=require('../api/stripe-webhook.js');
 const session={id:'cs_test_fixture',payment_status:'paid',metadata:{integration,delivery_zip:'33027'},collected_information:{shipping_details:{address:{country:'US',state:'FL',postal_code:'33027'}}},payment_intent:{id:'pi_fixture',status:'succeeded',metadata:{dispatch_status:'hold_for_jdg_approval'},latest_charge:{outcome:{risk_level:'normal'},payment_method_details:{card:{wallet:{type:'apple_pay'}}}}}};
 const payload=JSON.stringify({id:'evt_fixture',livemode:false,type:'checkout.session.completed',data:{object:session}});
 const request=(signature)=>Object.assign(Readable.from([Buffer.from(payload)]),{method:'POST',headers:{'stripe-signature':signature}});
 let updates=[];s.checkout.sessions.retrieve=async()=>session;s.paymentIntents.update=async(id,body)=>{updates.push(body);return {}};
 const invalid=response();await webhook(request('forged'),invalid);assert.equal(invalid.code,400);assert.equal(updates.length,0);
 const signature=Stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
 const valid=response();await webhook(request(signature),valid);assert.equal(valid.code,200);assert.equal(updates.length,1);
 assert.equal(updates[0].metadata.jdg_payment_verified,'true');assert.equal(updates[0].metadata.jdg_authentication,'wallet_apple_pay');assert.equal(updates[0].metadata.dispatch_status,undefined);
 session.payment_status='unpaid';session.payment_intent.status='processing';const unpaid=response();await webhook(request(signature),unpaid);assert.equal(unpaid.code,200);assert.equal(updates.length,1);
 session.payment_status='paid';session.payment_intent.status='succeeded';session.collected_information.shipping_details.address.state='NY';const mismatch=response();await webhook(request(signature),mismatch);assert.equal(updates[1].metadata.jdg_review_flags,'delivery_address_requires_review');
 delete process.env.STRIPE_SECRET_KEY;delete process.env.STRIPE_WEBHOOK_SECRET;
});
