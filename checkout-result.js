'use strict';
(async()=>{
 const id=new URLSearchParams(location.search).get('session_id');
 const title=document.getElementById('title'),status=document.getElementById('status');
 if(!id){title.textContent='Payment status unavailable';status.textContent='Open the confirmation link from your checkout, or contact JDG to confirm your order.';return}
 try{
  const response=await fetch('/api/order-status?session_id='+encodeURIComponent(id),{cache:'no-store',signal:AbortSignal.timeout(15000)});const order=await response.json();
  if(!response.ok)throw new Error(order.error);
  document.getElementById('reference').textContent='Order reference: '+order.reference;
  title.textContent=order.paid?'Payment received':'Payment not confirmed';
  status.textContent=order.paid?'Thank you. Your order is awaiting JDG review and delivery confirmation.':'Stripe has not confirmed a completed payment. Contact JDG if your bank shows a charge before trying again.';
  if(order.paid){try{const snapshot=sessionStorage.getItem('jdg-checkout-cart');if(snapshot&&snapshot!=='null'&&localStorage.getItem('jdg-load-cart-v1')===snapshot)localStorage.removeItem('jdg-load-cart-v1');sessionStorage.removeItem('jdg-checkout-cart')}catch{}}
 }catch{title.textContent='We could not verify your payment';status.textContent='Please contact JDG to confirm your payment before trying again.'}
})();
