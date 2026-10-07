'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verifyMerchant}=require('../lib/stripe.cjs');

function merchant(){
 const state={
  account:{id:'acct_jdg_fixture',charges_enabled:true},settings:{status:'active'},
  registrations:{data:[{country:'US',status:'active',country_options:{us:{state:'FL'}}}]},
  methods:{data:[{active:true,is_default:true,card:{available:true,display_preference:{value:'on'}},apple_pay:{available:true,display_preference:{value:'on'}}}]}
 };
 return {state,client:{accounts:{retrieve:async()=>state.account},tax:{settings:{retrieve:async()=>state.settings},registrations:{list:async()=>state.registrations}},paymentMethodConfigurations:{list:async()=>state.methods}}};
}
async function withEnvironment(environment,key,run){
 const names=['VERCEL_ENV','STRIPE_SECRET_KEY','STRIPE_ACCOUNT_ID'];const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 process.env.VERCEL_ENV=environment;process.env.STRIPE_SECRET_KEY=key;process.env.STRIPE_ACCOUNT_ID='acct_jdg_fixture';
 try{return await run()}finally{for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name]}}
}
const rejects=(client,message)=>assert.rejects(()=>verifyMerchant(client),error=>error.status===503&&error.message===message);

test('merchant readiness accepts the matched account with active Florida tax and default card plus Apple Pay',async()=>{
 await withEnvironment('production','rk_live_fixture',async()=>assert.equal(await verifyMerchant(merchant().client),true));
 await withEnvironment('preview','rk_test_fixture',async()=>assert.equal(await verifyMerchant(merchant().client),true));
});

test('merchant readiness rejects a different account or an account unable to charge',async()=>{
 await withEnvironment('production','rk_live_fixture',async()=>{
  for(const patch of [{id:'acct_other_fixture'},{charges_enabled:false}]){
   const fixture=merchant();Object.assign(fixture.state.account,patch);await rejects(fixture.client,'Payment account is not ready.');
  }
 });
});

test('merchant readiness separates live production credentials from sandbox preview and development',async()=>{
 for(const [environment,key] of [['production','rk_test_fixture'],['preview','rk_live_fixture'],['development','rk_live_fixture']]){
  await withEnvironment(environment,key,()=>rejects(merchant().client,'Payment account is not ready.'));
 }
});

test('merchant readiness requires active tax settings and an active US Florida registration',async()=>{
 await withEnvironment('production','rk_live_fixture',async()=>{
  const inactiveSettings=merchant();inactiveSettings.state.settings.status='pending';await rejects(inactiveSettings.client,'Tax setup is not ready.');
  for(const registration of [null,{country:'US',status:'active',country_options:{us:{state:'NY'}}},{country:'US',status:'inactive',country_options:{us:{state:'FL'}}},{country:'CA',status:'active',country_options:{us:{state:'FL'}}}]){
   const fixture=merchant();fixture.state.registrations.data=registration?[registration]:[];await rejects(fixture.client,'Tax setup is not ready.');
  }
 });
});

test('merchant readiness requires an active default configuration with card and Apple Pay available and on',async()=>{
 await withEnvironment('production','rk_live_fixture',async()=>{
  const changes=[method=>{method.active=false},method=>{method.is_default=false},method=>{method.card.available=false},method=>{method.card.display_preference.value='off'},method=>{method.apple_pay.available=false},method=>{method.apple_pay.display_preference.value='off'}];
  const missing=merchant();missing.state.methods.data=[];await rejects(missing.client,'Payment methods are not ready.');
  for(const change of changes){const fixture=merchant();change(fixture.state.methods.data[0]);await rejects(fixture.client,'Payment methods are not ready.')}
 });
});
