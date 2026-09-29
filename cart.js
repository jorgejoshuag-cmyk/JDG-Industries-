'use strict';
// Only material IDs and quantities are stored. Contact details stay in the form.
const cartKey='jdg-load-cart-v1';
let cart=[];
try{const saved=JSON.parse(localStorage.getItem(cartKey)||'[]');if(Array.isArray(saved))cart=saved.filter(x=>Number.isInteger(x.material)&&products[x.material]&&Number.isFinite(x.tons)&&x.tons>=.5&&x.tons<=22&&Number.isInteger(x.tons*2)).slice(0,30)}catch{}
let quotingCart=false;
const cartDialog=$('cart-dialog');
const deliveryFor=tons=>tons<=11?145:185;
function cartTotals(){return cart.reduce((sum,item)=>({material:sum.material+products[item.material].price*item.tons,delivery:sum.delivery+deliveryFor(item.tons),fuel:sum.fuel+25,tons:sum.tons+item.tons}),{material:0,delivery:0,fuel:0,tons:0})}
function persistCart(){try{localStorage.setItem(cartKey,JSON.stringify(cart))}catch{}}
function setCartQuote(active){quotingCart=active&&cart.length>0;$('cart-quote-summary').hidden=!quotingCart;for(const id of ['quote-material','quote-tons']){$(id).disabled=quotingCart;$(id).parentElement.hidden=quotingCart}window.jdgCartQuote=quotingCart?cartQuoteBody:null;if(quotingCart){const t=cartTotals();$('cart-quote-copy').textContent=cart.length+' separate load'+(cart.length===1?'':'s')+' · '+t.tons+' tons · '+money(t.material+t.delivery+t.fuel)+' estimated before tax and additional charges.'}}
function renderCart(){
  document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=String(cart.length));
  const container=$('cart-items');container.replaceChildren();
  if(!cart.length){const p=document.createElement('p');p.className='cart-empty';p.textContent='Your cart is empty. Choose a material and tonnage in the load estimator to get started.';container.append(p)}
  cart.forEach((item,index)=>{
    const product=products[item.material],row=document.createElement('div');row.className='cart-row';
    const details=document.createElement('div'),h=document.createElement('h3'),price=document.createElement('p');h.textContent=product.name;price.textContent=money(product.price)+'/ton · Load '+(index+1);details.append(h,price);
    const label=document.createElement('label');label.textContent='Tons';const input=document.createElement('input');Object.assign(input,{type:'number',min:'.5',max:'22',step:'.5',value:String(item.tons),required:true});input.inputMode='decimal';input.setAttribute('aria-label','Tons for load '+(index+1)+', '+product.name);label.append(input);
    input.addEventListener('input',()=>{$('request-cart').disabled=!!cartDialog.querySelector('input:invalid')});
    input.addEventListener('change',()=>{if(!input.checkValidity()){input.reportValidity();return}item.tons=Number(input.value);persistCart();renderCart()});
    const subtotal=document.createElement('small');subtotal.textContent=money(item.tons*product.price)+' material + '+money(deliveryFor(item.tons))+' delivery + $25.00 fuel';
    const remove=document.createElement('button');remove.type='button';remove.className='remove-load';remove.textContent='Remove load';remove.setAttribute('aria-label','Remove load '+(index+1)+', '+product.name);remove.addEventListener('click',()=>{cart.splice(index,1);persistCart();renderCart();const next=container.querySelectorAll('.remove-load')[Math.min(index,cart.length-1)];(next||$('continue-shopping')).focus();$('cart-status').textContent='Load removed from cart.'});
    row.append(details,label,subtotal,remove);container.append(row);
  });
  const t=cartTotals(),totals=$('cart-totals');totals.replaceChildren();
  for(const [name,value] of [['Material',t.material],['Delivery ('+cart.length+' loads)',t.delivery],['Fuel',t.fuel],['Estimated subtotal',t.material+t.delivery+t.fuel]]){const div=document.createElement('div');if(name==='Estimated subtotal')div.className='cart-grand';const label=document.createElement('span'),amount=document.createElement('strong');label.textContent=name;amount.textContent=money(value);div.append(label,amount);totals.append(div)}
  totals.hidden=!cart.length;$('cart-disclaimer').hidden=!cart.length;$('request-cart').disabled=!cart.length;
  if(quotingCart)setCartQuote(true);
}
function openCart(){renderCart();cartDialog.showModal();document.body.style.overflow='hidden'}
function closeCart(){cartDialog.close()}
cartDialog.addEventListener('close',()=>{document.body.style.overflow=''});
document.querySelectorAll('[data-open-cart]').forEach(button=>button.addEventListener('click',openCart));
$('close-cart').addEventListener('click',closeCart);
$('continue-shopping').addEventListener('click',()=>{closeCart();$('materials').scrollIntoView({behavior:scrollBehavior()})});
cartDialog.addEventListener('click',event=>{if(event.target===cartDialog&&event.clientX<cartDialog.getBoundingClientRect().left)closeCart()});
$('add-to-cart').addEventListener('click',()=>{const estimate=calculate();if(!estimate)return;if(cart.length>=30){$('cart-status').textContent='Your cart has 30 loads. Contact JDG for larger projects.';openCart();return}cart.push({material:Number($('calc-material').value),tons:estimate.t});persistCart();$('cart-status').textContent=estimate.p.name+' added to cart.';openCart()});
$('request-cart').addEventListener('click',()=>{if(!cart.length)return;const invalid=cartDialog.querySelector('input:invalid');if(invalid){invalid.reportValidity();return}setCartQuote(true);closeCart();$('quote').scrollIntoView({behavior:scrollBehavior()});$('name').focus({preventScroll:true})});
$('single-quote').addEventListener('click',()=>{setCartQuote(false);$('quote-material').focus()});
$('use-estimate').addEventListener('click',()=>setCartQuote(false));
function cartQuoteBody(){const t=cartTotals();return ['JDG Aggregates cart quote request','Name: '+$('name').value.trim(),'Phone: '+$('phone').value.trim(),'Company / project: '+$('company').value.trim(),'Delivery ZIP: '+$('zip').value,'Requested date: '+($('date').value||'Please confirm availability'),'Notes: '+$('notes').value.trim(),'',...cart.map((item,i)=>'Load '+(i+1)+': '+item.tons+' tons of '+products[item.material].name+'; '+money(item.tons*products[item.material].price)+' material + '+money(deliveryFor(item.tons))+' delivery + $25.00 fuel.'),'','Estimated subtotal: '+money(t.material+t.delivery+t.fuel)+'. Before sales tax and additional charges. Please confirm pricing, availability and delivery.'].join('\n')}
function scrollBehavior(){return matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}
// Keep requested dates current in the customer's local timezone.
const today=new Date();$('date').min=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
renderCart();
