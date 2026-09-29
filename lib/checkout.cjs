'use strict';
const crypto = require('node:crypto');
const catalog = [
  ['ASTM #57 Stone',3400],['ASTM #67 Stone',3550],['#89 Stone',3450],['Ballast',3550],
  ['Concrete Screenings',3000],['Limerock Base',3000],['Fill Screenings',2200],['1/4" Stone',3600],['Lawn Screenings',1800]
];
const ORIGIN='https://www.jdgindustries.com';
const integration='jdg_aggregate_checkout_hmqrvxna';
function invalid(message){return Object.assign(new Error(message),{status:400})}
function validateOrder(body) {
  if(!body || !Array.isArray(body.items) || !body.items.length || body.items.length>30) throw invalid('Choose between 1 and 30 loads.');
  const items=body.items.map(item=>{
    if(!item || !Number.isInteger(item.material) || !catalog[item.material] || typeof item.tons!=='number' || !Number.isFinite(item.tons) || item.tons<.5 || item.tons>22 || !Number.isInteger(item.tons*2)) throw invalid('Each load must contain 0.5 to 22 tons in half-ton increments.');
    return {material:item.material,tons:item.tons};
  });
  if(!['Miami-Dade','Broward'].includes(body.county)) throw invalid('Online orders are for Miami-Dade and Broward only.');
  if(typeof body.zip!=='string' || !/^(330|331|332|333)\d{2}$/.test(body.zip)) throw invalid('Enter a delivery ZIP in our South Florida service area.');
  if(body.accepted!==true) throw invalid('Please acknowledge the order and delivery terms.');
  if(typeof body.requestId!=='string' || !/^[0-9a-f-]{36}$/i.test(body.requestId)) throw invalid('Please refresh the checkout and try again.');
  let date='';
  if(body.date){
    if(typeof body.date!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(Date.parse(body.date+'T12:00:00Z')) || new Date(body.date+'T12:00:00Z').toISOString().slice(0,10)!==body.date) throw invalid('Choose a valid requested delivery date.');
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(body.date<today) throw invalid('Choose today or a future delivery date.'); date=body.date;
  }
  return {items,county:body.county,zip:body.zip,date,requestId:body.requestId,accepted:true};
}
function buildSession(order, taxCodes, origin=ORIGIN) {
  const line_items=[];
  const line=(name,cents,code)=>({quantity:1,price_data:{currency:'usd',unit_amount:cents,tax_behavior:'exclusive',product_data:{name,tax_code:code}}});
  order.items.forEach((item,i)=>{
    const [name,price]=catalog[item.material];
    line_items.push(line(`Load ${i+1}: ${name} (${item.tons} tons)`,Math.round(price*item.tons),taxCodes.material));
    line_items.push(line(`Load ${i+1}: delivery`,item.tons<=11?14500:18500,taxCodes.delivery));
    line_items.push(line(`Load ${i+1}: fuel surcharge`,2500,taxCodes.fuel));
  });
  const digest=crypto.createHash('sha256').update(JSON.stringify({order,catalog,taxCodes})).digest('hex');
  const metadata={integration,order_reference:'JDG-'+order.requestId,dispatch_status:'hold_for_jdg_approval',county:order.county,delivery_zip:order.zip,requested_date:order.date||'To be arranged',terms_version:'2026-09-29',terms_acknowledged:'true',cart_digest:digest};
  order.items.forEach((item,i)=>{metadata['load_'+(i+1)]=`${item.tons} tons ${catalog[item.material][0]}`});
  const parameters={mode:'payment',currency:'usd',adaptive_pricing:{enabled:false},integration_identifier:integration,client_reference_id:metadata.order_reference,
    line_items,automatic_tax:{enabled:true},billing_address_collection:'required',shipping_address_collection:{allowed_countries:['US']},phone_number_collection:{enabled:true},
    payment_method_options:{card:{request_three_d_secure:'any'}},
    excluded_payment_method_types:['acss_debit','affirm','afterpay_clearpay','alipay','amazon_pay','bacs_debit','bancontact','blik','cashapp','crypto','customer_balance','eps','giropay','ideal','klarna','mb_way','multibanco','oxxo','p24','pay_by_bank','paypal','pix','promptpay','revolut_pay','satispay','sepa_debit','sofort','us_bank_account','wechat_pay','zip'],
    metadata,payment_intent_data:{metadata:{...metadata},description:`JDG aggregate order: ${order.items.length} load(s). HOLD FOR JDG APPROVAL.`},
    success_url:origin+'/checkout-result.html?session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/?checkout=cancelled#materials',
    custom_text:{shipping_address:{message:'Enter the actual jobsite delivery address in Miami-Dade or Broward, Florida. Use the same ZIP you entered on the website.'},submit:{message:'Payment does not confirm a delivery time. JDG reviews payment, availability, jobsite access and recipient before dispatch. Extra charges or quantity adjustments require your agreement.'}},
    custom_fields:[{key:'recipient',label:{type:'custom',custom:'On-site recipient name and phone'},type:'text',optional:false,text:{minimum_length:5,maximum_length:120}}]
  };
  return {parameters,idempotencyKey:`jdg-checkout-${digest}`};
}
module.exports={catalog,ORIGIN,integration,validateOrder,buildSession};
