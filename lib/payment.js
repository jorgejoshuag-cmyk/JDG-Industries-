'use strict';
const {estimate,products}=require('../assets/catalog');
const API_VERSION='2026-08-26.dahlia';
const localDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
class InputError extends Error{constructor(message,status=400){super(message);this.status=status}}
function configuration(env=process.env){
let zones={};try{zones=JSON.parse(env.JDG_DELIVERY_ZONES||'{}')}catch{}
if(!zones||typeof zones!=='object'||Array.isArray(zones))zones={};
const validZones=Object.keys(zones).length>0&&Object.entries(zones).every(([zip,county])=>/^\d{5}$/.test(zip)&&['Miami-Dade','Broward'].includes(county));
const skus=(env.JDG_APPROVED_SKUS||'').split(',').filter(Boolean);
const taxCodes={material:env.JDG_MATERIAL_TAX_CODE,delivery:env.JDG_DELIVERY_TAX_CODE,fuel:env.JDG_FUEL_TAX_CODE};
let origin='';try{const u=new URL(env.JDG_SITE_ORIGIN);if(u.protocol==='https:'&&u.pathname==='/'&&!u.search&&!u.hash)origin=u.origin}catch{}
const enabled=env.JDG_CHECKOUT_ENABLED==='true'&&env.JDG_CHECKOUT_QA_APPROVED==='true'&&env.JDG_ORDER_TERMS_APPROVED==='true'&&Boolean(env.STRIPE_SECRET_KEY&&env.STRIPE_WEBHOOK_SECRET)&&Boolean(origin)&&validZones&&skus.length>0&&skus.every(id=>products.some(p=>p.id===id))&&Object.values(taxCodes).every(c=>/^txcd_\d+$/.test(c||''))&&/^\d{4}-\d{2}-\d{2}$/.test(env.JDG_PRICING_VALID_UNTIL||'')&&env.JDG_PRICING_VALID_UNTIL>=localDate()&&Boolean(env.JDG_CHECKOUT_NOTICE)&&env.JDG_CHECKOUT_NOTICE.length<=450;
return {enabled,zones,skus,taxCodes,origin,notice:env.JDG_CHECKOUT_NOTICE||'Online payments are not active. Please request a confirmed quote.'};
}
function validateOrder(body,cfg){
if(!body||typeof body!=='object'||body.acknowledged!==true)throw new InputError('Confirm the order conditions first.');
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId||''))throw new InputError('Refresh the cart and retry.');
let order;try{order=estimate(body.lines)}catch(e){throw new InputError(e.message)}
if(order.subtotal>1000000)throw new InputError('Orders above $10,000 before tax require a confirmed project quote.');
if(order.lines.some(l=>!cfg.skus.includes(l.id)))throw new InputError('One or more materials require a confirmed quote.');
const b=body.buyer;if(!b||typeof b!=='object')throw new InputError('Complete your delivery details.');
for(const [key,max] of Object.entries({name:100,phone:30,email:254,address:200,city:100,zip:5,date:10}))if(typeof b[key]!=='string'||!b[key].trim()||b[key].length>max||/[\u0000-\u001f]/.test(b[key]))throw new InputError('Check your '+key+' and try again.');
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||!/^\+?[\d\s().-]{7,30}$/.test(b.phone))throw new InputError('Enter a valid email and phone number.');
if(!/^\d{5}$/.test(b.zip)||!cfg.zones[b.zip])throw new InputError('This delivery ZIP requires a confirmed quote. No payment has been taken.');
if(!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||b.date<localDate()||Number.isNaN(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date)throw new InputError('Select a current or future requested delivery date.');
if(b.notes!==undefined&&(typeof b.notes!=='string'||b.notes.length>1000))throw new InputError('Shorten the delivery notes.');
return {order,buyer:{...b,name:b.name.trim(),email:b.email.trim().toLowerCase()},requestId:body.requestId};
}
function getStripe(env=process.env){const Stripe=require('stripe');return new Stripe(env.STRIPE_SECRET_KEY,{apiVersion:API_VERSION,maxNetworkRetries:1,timeout:12000})}
function send(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(data))}
async function readRaw(req,max=65536){if(Buffer.isBuffer(req.body)){if(req.body.length>max)throw new InputError('Request too large.',413);return req.body}if(typeof req.body==='string'){if(Buffer.byteLength(req.body)>max)throw new InputError('Request too large.',413);return Buffer.from(req.body)}const parts=[];let length=0;for await(const part of req){const p=Buffer.from(part);length+=p.length;if(length>max)throw new InputError('Request too large.',413);parts.push(p)}return Buffer.concat(parts)}
async function readJson(req){if(req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body)){if(Buffer.byteLength(JSON.stringify(req.body))>32768)throw new InputError('Request too large.',413);return req.body}try{return JSON.parse((await readRaw(req,32768)).toString('utf8'))}catch(e){if(e instanceof InputError)throw e;throw new InputError('Invalid request.')}}
function buildLineItems(order,cfg){const result=[];for(const line of order.lines){const p=products.find(p=>p.id===line.id);result.push({price_data:{currency:'usd',unit_amount:p.cents/2,tax_behavior:'exclusive',product_data:{name:p.name+' (0.5 ton)',tax_code:cfg.taxCodes.material}},quantity:line.tons*2*line.loads});result.push({price_data:{currency:'usd',unit_amount:line.tons<=11?14500:18500,tax_behavior:'exclusive',product_data:{name:p.name+' delivery ('+line.tons+' tons/load)',tax_code:cfg.taxCodes.delivery}},quantity:line.loads});result.push({price_data:{currency:'usd',unit_amount:2500,tax_behavior:'exclusive',product_data:{name:p.name+' fuel surcharge',tax_code:cfg.taxCodes.fuel}},quantity:line.loads});}return result}
module.exports={API_VERSION,InputError,configuration,validateOrder,getStripe,send,readRaw,readJson,buildLineItems};
