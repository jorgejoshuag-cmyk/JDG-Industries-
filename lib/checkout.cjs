'use strict';
const crypto = require('node:crypto');
const catalog = [
  ['ASTM #57 Stone',3400],['ASTM #67 Stone',3550],['#89 Stone',3450],['Ballast',3550],
  ['Concrete Screenings',3000],['Limerock Base',3000],['Fill Screenings',2200],['1/4" Stone',3600],['Lawn Screenings',1800]
];
const ORIGIN='https://www.jdgindustries.com';
const integration='jdg_aggregate_checkout_hmqrvxna';
const DELIVERY_CENTS=19500,FUEL_CENTS=4500;
function invalid(message){return Object.assign(new Error(message),{status:400})}
function quoteRequired(){return Object.assign(new Error('JDG must review the actual jobsite, delivery plan and any out-of-area fuel surcharge before payment. Your cart is saved; request a quote.'),{status:409,code:'quote_required'})}
function validateOrder(body) {
  if(!body || !Array.isArray(body.items) || !body.items.length || body.items.length>30) throw invalid('Choose between 1 and 30 material entries.');
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
  const requestedDeliveries=body.requestedDeliveries===undefined?items.length:body.requestedDeliveries;
  if(!Number.isInteger(requestedDeliveries) || requestedDeliveries<Math.ceil(items.reduce((sum,item)=>sum+item.tons,0)/22) || requestedDeliveries>30) throw invalid('Request a valid delivery count for the total tonnage. JDG must confirm the actual delivery plan.');
  return {items,requestedDeliveries,county:body.county,zip:body.zip,date,requestId:body.requestId,accepted:true};
}
function buildSession(order, taxCodes, origin=ORIGIN, reviewedPlan) {
  // Pure pricing builder for a future trusted, server-owned quote workflow.
  // Structural validation is NOT authentication. No HTTP route accepts this plan
  // from customers; checkout remains blocked until JDG approval is implemented.
  if(!reviewedPlan || typeof reviewedPlan.quoteReference!=='string' || !/^[A-Za-z0-9-]{3,80}$/.test(reviewedPlan.quoteReference) || !Array.isArray(reviewedPlan.deliveries) || !reviewedPlan.deliveries.length || reviewedPlan.deliveries.length>30) throw quoteRequired();
  const seen=new Set();
  for(const delivery of reviewedPlan.deliveries){
    if(!Array.isArray(delivery) || !delivery.length) throw invalid('Each confirmed delivery must identify its materials.');
    let tons=0;
    for(const index of delivery){
      if(!Number.isInteger(index) || !order.items[index] || seen.has(index)) throw invalid('The confirmed delivery plan must cover each material entry once.');
      seen.add(index);tons+=order.items[index].tons;
    }
    if(tons>22) throw invalid('A confirmed delivery cannot exceed 22 tons.');
  }
  if(seen.size!==order.items.length) throw invalid('The confirmed delivery plan must include every material entry.');
  const line_items=[];
  const line=(name,cents,code)=>({quantity:1,price_data:{currency:'usd',unit_amount:cents,tax_behavior:'exclusive',product_data:{name,tax_code:code}}});
  reviewedPlan.deliveries.forEach((delivery,i)=>{
    for(const index of delivery){
      const item=order.items[index],[name,price]=catalog[item.material];
      line_items.push(line(`Delivery ${i+1}: ${name} (${item.tons} tons)`,Math.round(price*item.tons),taxCodes.material));
    }
    line_items.push(line(`Delivery ${i+1}: delivery`,DELIVERY_CENTS,taxCodes.delivery));
    line_items.push(line(`Delivery ${i+1}: fuel surcharge`,FUEL_CENTS,taxCodes.fuel));
  });
  const digest=crypto.createHash('sha256').update(JSON.stringify({order,catalog,taxCodes,reviewedPlan,delivery:DELIVERY_CENTS,fuel:FUEL_CENTS})).digest('hex');
  const metadata={integration,order_reference:'JDG-'+order.requestId,dispatch_status:'hold_for_jdg_approval',county:order.county,delivery_zip:order.zip,requested_date:order.date||'To be arranged',terms_version:'2026-09-29',terms_acknowledged:'true',cart_digest:digest,pricing_version:'2026-10-22',delivery_count:String(reviewedPlan.deliveries.length),requested_deliveries:String(order.requestedDeliveries),quote_reference:reviewedPlan.quoteReference};
  reviewedPlan.deliveries.forEach((delivery,i)=>{for(const index of delivery){const item=order.items[index];metadata['material_'+(index+1)]=`Delivery ${i+1}: ${item.tons} tons ${catalog[item.material][0]}`}});
  const parameters={mode:'payment',currency:'usd',adaptive_pricing:{enabled:false},integration_identifier:integration,client_reference_id:metadata.order_reference,
    line_items,automatic_tax:{enabled:true},billing_address_collection:'required',shipping_address_collection:{allowed_countries:['US']},phone_number_collection:{enabled:true},
    payment_method_options:{card:{request_three_d_secure:'any'}},
    excluded_payment_method_types:['acss_debit','affirm','afterpay_clearpay','alipay','amazon_pay','bacs_debit','bancontact','blik','cashapp','crypto','customer_balance','eps','giropay','ideal','klarna','mb_way','multibanco','oxxo','p24','pay_by_bank','paypal','pix','promptpay','revolut_pay','satispay','sepa_debit','sofort','us_bank_account','wechat_pay','zip'],
    metadata,payment_intent_data:{metadata:{...metadata},description:`JDG aggregate order: ${reviewedPlan.deliveries.length} delivery(s). HOLD FOR JDG APPROVAL.`},
    success_url:origin+'/checkout-result.html?session_id={CHECKOUT_SESSION_ID}',cancel_url:origin+'/?checkout=cancelled#materials',
    custom_text:{shipping_address:{message:'Enter the actual jobsite delivery address in Miami-Dade or Broward, Florida. Use the same ZIP you entered on the website.'},submit:{message:'Payment does not confirm a delivery time. JDG reviews payment, availability, jobsite access and recipient before dispatch. Extra charges or quantity adjustments require your agreement.'}},
    custom_fields:[{key:'recipient',label:{type:'custom',custom:'On-site recipient name and phone'},type:'text',optional:false,text:{minimum_length:5,maximum_length:120}}]
  };
  return {parameters,idempotencyKey:`jdg-checkout-${digest}`};
}
module.exports={catalog,ORIGIN,integration,DELIVERY_CENTS,FUEL_CENTS,quoteRequired,validateOrder,buildSession};
