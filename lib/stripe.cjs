'use strict';
const Stripe=require('stripe');
let client;
function stripe(){
 if(!process.env.STRIPE_SECRET_KEY) throw Object.assign(new Error('Checkout is not connected yet.'),{status:503});
 return client ||= new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2026-08-26.dahlia',maxNetworkRetries:2,timeout:12000});
}
function appOrigin(){return process.env.VERCEL_ENV==='preview' && /^[a-zA-Z0-9.-]+\.vercel\.app$/.test(process.env.VERCEL_URL||'') ? 'https://'+process.env.VERCEL_URL : 'https://www.jdgindustries.com'}
function configReady(){return process.env.CHECKOUT_ENABLED==='true' && !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET && !!process.env.STRIPE_ACCOUNT_ID && ['STRIPE_MATERIAL_TAX_CODE','STRIPE_DELIVERY_TAX_CODE','STRIPE_FUEL_TAX_CODE'].every(k=>/^txcd_\d+$/.test(process.env[k]||''))}
async function verifyMerchant(s){
 const [account,settings,registrations,config]=await Promise.all([
  s.accounts.retrieve(),s.tax.settings.retrieve(),s.tax.registrations.list({status:'active',limit:100}),s.paymentMethodConfigurations.list({limit:100})
 ]);
 const expectedLive=process.env.VERCEL_ENV==='production';
 if(account.id!==process.env.STRIPE_ACCOUNT_ID || !account.charges_enabled || (expectedLive ? !/^[sr]k_live_/.test(process.env.STRIPE_SECRET_KEY) : !/^[sr]k_test_/.test(process.env.STRIPE_SECRET_KEY))) throw Object.assign(new Error('Payment account is not ready.'),{status:503});
 if(settings.status!=='active' || !registrations.data.some(r=>r.country==='US'&&r.country_options?.us?.state==='FL'&&r.status==='active')) throw Object.assign(new Error('Tax setup is not ready.'),{status:503});
 const pmc=config.data.find(c=>c.active&&c.is_default);
 if(!pmc?.card?.available || pmc.card.display_preference?.value!=='on' || !pmc.apple_pay?.available || pmc.apple_pay.display_preference?.value!=='on') throw Object.assign(new Error('Payment methods are not ready.'),{status:503});
 return true;
}
function respond(res,status,data){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');return res.status(status).json(data)}
module.exports={stripe,appOrigin,configReady,verifyMerchant,respond};
