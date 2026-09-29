'use strict';
const checkoutDialog=$('checkout-dialog'),checkoutForm=$('checkout-form');
let checkoutItems=[],checkoutRequestId='',checkoutReady=false,checkoutBusy=false,checkoutUsesCart=false;
let availabilityVersion=0;
function showCheckoutError(message){$('checkout-error').textContent=message;$('checkout-error').hidden=!message}
function setCheckoutBusy(busy){checkoutBusy=busy;$('checkout-submit').disabled=busy||!checkoutReady;$('checkout-submit').textContent=busy?'Opening secure checkout…':'Continue to secure payment'}
function checkoutSummary(){
 const container=$('checkout-summary');container.replaceChildren();let total=0;
 checkoutItems.forEach((item,i)=>{const p=document.createElement('p'),product=products[item.material],cost=product.price*item.tons+deliveryFor(item.tons)+25;total+=cost;p.textContent=`Load ${i+1}: ${item.tons} tons of ${product.name} · ${money(cost)}`;container.append(p)});
 const summary=document.createElement('strong');summary.textContent=`Subtotal ${money(total)} before sales tax`;container.append(summary);
}
async function openCheckout(items,usesCart=false){
 if(!items.length)return;
 checkoutItems=items.map(item=>({...item}));checkoutUsesCart=usesCart;checkoutRequestId=crypto.randomUUID();checkoutReady=false;
 showCheckoutError('');checkoutSummary();setCheckoutBusy(false);
 $('checkout-availability').textContent='Checking payment availability…';$('checkout-wallets').hidden=true;checkoutForm.hidden=true;
 if(cartDialog.open)cartDialog.close();
 checkoutDialog.showModal();document.body.style.overflow='hidden';
 const version=++availabilityVersion;
 try{
  const response=await fetch('/api/checkout-status',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  const state=response.ok?await response.json():{ready:false};if(version!==availabilityVersion)return;
  checkoutReady=state.ready===true;
 }catch{if(version!==availabilityVersion)return;checkoutReady=false}
 checkoutForm.hidden=!checkoutReady;$('checkout-wallets').hidden=!checkoutReady;
 $('checkout-availability').textContent=checkoutReady?'Enter your delivery area, then choose your payment method at Stripe.':'Online payment is not available yet. Keep your load selection and request an estimate, or call JDG to arrange your order.';
 setCheckoutBusy(false);
 if(checkoutReady)$('checkout-county').focus();
}
function addProductToCart(material,tons){
 if(cart.length>=30){openCart();$('cart-status').textContent='Your cart has 30 loads. Contact JDG for larger orders.';return}
 cart.push({material,tons});persistCart();openCart();$('cart-status').textContent=products[material].name+' added to cart.';
}
document.querySelectorAll('[data-buy-product]').forEach(button=>button.addEventListener('click',()=>{const i=Number(button.dataset.buyProduct);openCheckout([{material:i,tons:Number($('product-tons-'+i).value)}])}));
document.querySelectorAll('[data-add-product]').forEach(button=>button.addEventListener('click',()=>{const i=Number(button.dataset.addProduct);addProductToCart(i,Number($('product-tons-'+i).value))}));
$('buy-now').addEventListener('click',()=>{const estimate=calculate();if(estimate)openCheckout([{material:Number($('calc-material').value),tons:estimate.t}])});
$('checkout-cart').addEventListener('click',()=>{const invalid=cartDialog.querySelector('input:invalid');if(invalid){invalid.reportValidity();return}openCheckout(cart,true)});
$('close-checkout').addEventListener('click',()=>checkoutDialog.close());
checkoutDialog.addEventListener('close',()=>{document.body.style.overflow='';availabilityVersion++});
$('checkout-terms').addEventListener('click',()=>checkoutDialog.close());
$('checkout-estimate').addEventListener('click',()=>{
 checkoutDialog.close();
 if(checkoutUsesCart){setCartQuote(true)}else{setCartQuote(false);$('quote-material').value=checkoutItems[0].material;$('quote-tons').value=checkoutItems[0].tons}
 $('quote').scrollIntoView({behavior:scrollBehavior()});$('name').focus({preventScroll:true});
});
checkoutForm.addEventListener('input',()=>{if(!checkoutBusy)checkoutRequestId=crypto.randomUUID()});
checkoutForm.addEventListener('submit',async event=>{
 event.preventDefault();if(checkoutBusy||!checkoutReady||!checkoutForm.reportValidity())return;
 setCheckoutBusy(true);showCheckoutError('');
 const order={items:checkoutItems,county:$('checkout-county').value,zip:$('checkout-zip').value,date:$('checkout-date').value,accepted:$('checkout-accept').checked,requestId:checkoutRequestId};
 try{
  const response=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(order),signal:AbortSignal.timeout(45000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to start checkout. Please try again.');
  const destination=new URL(result.url);if(destination.protocol!=='https:'||destination.hostname!=='checkout.stripe.com')throw new Error('Unable to open secure checkout. Please contact JDG.');
  // Store only the purchased cart snapshot, never contact or card details.
  try{sessionStorage.setItem('jdg-checkout-cart',JSON.stringify(checkoutUsesCart?checkoutItems:null))}catch{}
  window.location.assign(destination.href);
 }catch(error){showCheckoutError(error.name==='TimeoutError'?'The connection timed out. Try again; your checkout request will not be duplicated.':error.message);setCheckoutBusy(false)}
});
$('checkout-date').min=$('date').min;
if(new URLSearchParams(location.search).get('checkout')==='cancelled'){
 $('cart-status').textContent='You returned from checkout. Your cart is saved. No delivery has been scheduled.';
 if(cart.length)openCart();history.replaceState(null,'',location.pathname+location.hash);
}
