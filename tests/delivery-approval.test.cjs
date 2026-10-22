'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validateOrder,buildSession,ORIGIN}=require('../lib/checkout.cjs');
const base=()=>({items:[{material:0,tons:22}],county:'Broward',zip:'33027',requestId:'11111111-2222-4333-8444-555555555555',accepted:true});
const codes={material:'txcd_fixture',delivery:'txcd_fixture',fuel:'txcd_fixture'};
const plan=deliveries=>({quoteReference:'JDG-UNIT-QUOTE',deliveries});
const amount=parameters=>parameters.line_items.reduce((sum,line)=>sum+line.price_data.unit_amount*line.quantity,0);
const fees=parameters=>parameters.line_items.filter(line=>/delivery|fuel surcharge/.test(line.price_data.product_data.name));
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(body){this.body=body;return this}});

test('server charges the same $195 delivery and $45 fuel for half and full confirmed deliveries',()=>{
 for(const tons of [.5,11,22]){
  const order=validateOrder({...base(),items:[{material:0,tons,price:1,delivery:0,fuel:0}]});
  const {parameters}=buildSession(order,codes,ORIGIN,plan([[0]]));
  assert.deepEqual(fees(parameters).map(line=>line.price_data.unit_amount),[19500,4500]);
  assert.equal(amount(parameters),Math.round(3400*tons)+24000);
 }
});

test('material rows share one fee pair only when a server-owned plan confirms one actual delivery',()=>{
 const order=validateOrder({...base(),items:[{material:0,tons:5},{material:0,tons:6},{material:8,tons:4.5}],requestedDeliveries:1});
 const {parameters}=buildSession(order,codes,ORIGIN,plan([[0,1,2]]));
 assert.equal(parameters.line_items.length,5);
 assert.equal(fees(parameters).length,2);
 assert.equal(amount(parameters),3400*11+1800*4.5+24000);
 assert.equal(parameters.metadata.delivery_count,'1');
 assert.equal(parameters.metadata.quote_reference,'JDG-UNIT-QUOTE');
 assert.equal(parameters.metadata.load_1,undefined);
 assert.equal(parameters.metadata.material_1,'Delivery 1: 5 tons ASTM #57 Stone');
 assert.equal(parameters.metadata.material_2,'Delivery 1: 6 tons ASTM #57 Stone');
});

test('multiple confirmed deliveries each receive exactly $240 while all material prices remain authoritative',()=>{
 const order=validateOrder({...base(),items:[{material:0,tons:5,price:0},{material:0,tons:6,price:1},{material:8,tons:22,price:-1}],requestedDeliveries:2});
 const {parameters}=buildSession(order,codes,ORIGIN,plan([[0,1],[2]]));
 assert.equal(parameters.line_items.length,7);
 assert.equal(amount(parameters),3400*11+1800*22+24000*2);
 assert.equal(parameters.metadata.delivery_count,'2');
 assert.equal(parameters.metadata.dispatch_status,'hold_for_jdg_approval');
 assert.equal(parameters.payment_intent_data.metadata.dispatch_status,'hold_for_jdg_approval');
});

test('session pricing refuses absent, incomplete, duplicated and over-capacity confirmed delivery plans',()=>{
 const order=validateOrder({...base(),items:[{material:0,tons:11},{material:8,tons:22}]});
 for(const candidate of [undefined,{},plan([]),plan([[0]]),plan([[0],[0,1]]),plan([[0,1]]),plan([[0],[2]]),{quoteReference:'',deliveries:[[0],[1]]}]){
  assert.throws(()=>buildSession(order,codes,ORIGIN,candidate));
 }
});

test('requested delivery counts are planning data and cannot be smaller than physical capacity',()=>{
 const input={...base(),items:[{material:0,tons:11},{material:8,tons:11}],requestedDeliveries:1,approved:true,reviewedPlan:plan([[0,1]])};
 const order=validateOrder(input);
 assert.equal(order.requestedDeliveries,1);
 assert.equal(order.approved,undefined);
 assert.equal(order.reviewedPlan,undefined);
 for(const requestedDeliveries of [0,31,1.5,'1'])assert.throws(()=>validateOrder({...input,requestedDeliveries}));
 assert.throws(()=>validateOrder({...input,items:[{material:0,tons:22},{material:8,tons:22}],requestedDeliveries:1}));
});

test('even complete merchant configuration and forged browser approvals cannot pay for an unreviewed address',async()=>{
 const original={...process.env};
 Object.assign(process.env,{CHECKOUT_ENABLED:'true',STRIPE_SECRET_KEY:'rk_test_unit_fixture',STRIPE_WEBHOOK_SECRET:'whsec_unit_fixture',STRIPE_ACCOUNT_ID:'acct_fixture',STRIPE_MATERIAL_TAX_CODE:'txcd_100',STRIPE_DELIVERY_TAX_CODE:'txcd_200',STRIPE_FUEL_TAX_CODE:'txcd_300',VERCEL_ENV:'preview',VERCEL_URL:'jdg-unit-preview.vercel.app'});
 try{
  const s=require('../lib/stripe.cjs').stripe();let calls=0;
  s.accounts.retrieve=async()=>{calls++;return {id:'acct_fixture',charges_enabled:true}};
  s.tax.settings.retrieve=async()=>{calls++;return {status:'active'}};
  s.tax.registrations.list=async()=>{calls++;return {data:[{country:'US',country_options:{us:{state:'FL'}},status:'active'}]}};
  const method={available:true,display_preference:{value:'on'}};
  s.paymentMethodConfigurations.list=async()=>{calls++;return {data:[{active:true,is_default:true,card:method,apple_pay:method}]}};
  s.checkout.sessions.create=async()=>{calls++;return {url:'https://checkout.stripe.com/c/pay/unit_fixture'}};
  const state=response();await require('../api/checkout-status.js')({method:'GET'},state);
  assert.equal(state.body.ready,false);assert.equal(state.body.reason,'quote_required');
  for(const county of ['Broward','Miami-Dade']){
   const res=response();await require('../api/checkout.js')({method:'POST',headers:{origin:'https://jdg-unit-preview.vercel.app','content-type':'application/json'},body:{...base(),county,approved:true,addressApproved:true,quoteApproved:true,deliveryPlan:plan([[0]]),outOfArea:false}},res);
   assert.equal(res.code,409);assert.equal(res.body.code,'quote_required');
  }
  assert.equal(calls,0,'Unreviewed orders must stop before merchant calls or session creation.');
 }finally{for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);}
});
