'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../checkout.js'),'utf8');
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}}
class Element {
 constructor(){this.listeners=new Map();this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.open=false;this.textContent='';this.style={}}
 addEventListener(type,handler){const handlers=this.listeners.get(type)||[];handlers.push(handler);this.listeners.set(type,handlers)}
 emit(type){return Promise.all((this.listeners.get(type)||[]).map(handler=>handler({type,target:this,preventDefault(){}})))}
 replaceChildren(...children){this.children=children}
 append(...children){this.children=(this.children||[]).concat(children)}
 showModal(){this.open=true}
 close(){this.open=false;return this.emit('close')}
 focus(){}
 reportValidity(){return true}
 querySelector(){return null}
}
function harness(){
 const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
 element('checkout-county').value='Broward';element('checkout-zip').value='33027';element('checkout-accept').checked=true;
 const requests=[],pending=[],redirects=[],storage=new Map();let uuid=0;
 const context=vm.createContext({
  $:element,products:[{name:'ASTM #57 Stone',price:34}],money:amount=>'$'+amount.toFixed(2),deliveryFor:()=>185,
  document:{body:{style:{}},createElement:()=>new Element(),querySelectorAll:()=>[]},
  cartDialog:element('cart-dialog'),cart:[],calculate:()=>null,setCartQuote(){},scrollBehavior:()=> 'auto',
  crypto:{randomUUID:()=>`11111111-2222-4333-8444-${String(++uuid).padStart(12,'0')}`},AbortSignal:{timeout:()=>({})},
  URL,URLSearchParams,location:{search:'',pathname:'/',hash:''},history:{replaceState(){}},
  window:{location:{assign:url=>redirects.push(url)}},sessionStorage:{setItem:(key,value)=>storage.set(key,value)},
  fetch:async(url,options)=>{
   if(url==='/api/checkout-status')return {ok:true,json:async()=>({ready:true})};
   assert.equal(url,'/api/checkout');requests.push(JSON.parse(options.body));const request=deferred();pending.push(request);return request.promise;
  }
 });
 vm.runInContext(source,context,{filename:'checkout.js'});
 return {element,requests,pending,redirects,storage,open:(usesCart=false)=>vm.runInContext('openCheckout([{material:0,tons:22}],'+usesCart+')',context),requestId:()=>vm.runInContext('checkoutRequestId',context),busy:()=>vm.runInContext('checkoutBusy',context)};
}
const failedResponse={ok:false,json:async()=>({error:'Temporary connection failure.'})};

test('pending checkout ignores repeated form submission and preserves the request ID during input',async()=>{
 const ui=harness();await ui.open();const id=ui.requestId();
 const submission=ui.element('checkout-form').emit('submit');
 assert.equal(ui.busy(),true);assert.equal(ui.element('checkout-submit').disabled,true);
 assert.equal(ui.element('checkout-submit').textContent,'Opening secure checkout…');
 await ui.element('checkout-form').emit('input');await ui.element('checkout-form').emit('submit');
 assert.equal(ui.requestId(),id);assert.equal(ui.requests.length,1);assert.equal(ui.requests[0].requestId,id);
 ui.pending[0].resolve(failedResponse);await submission;
});

test('failed checkout unlocks retry with the same request ID; a later edit creates a fresh request',async()=>{
 const ui=harness();await ui.open();const id=ui.requestId();
 const first=ui.element('checkout-form').emit('submit');ui.pending[0].resolve(failedResponse);await first;
 assert.equal(ui.busy(),false);assert.equal(ui.element('checkout-submit').disabled,false);
 assert.equal(ui.element('checkout-error').textContent,'Temporary connection failure.');
 const retry=ui.element('checkout-form').emit('submit');assert.equal(ui.requests.length,2);assert.equal(ui.requests[1].requestId,id);
 ui.pending[1].resolve(failedResponse);await retry;
 await ui.element('checkout-form').emit('input');assert.notEqual(ui.requestId(),id);
});

test('successful pending checkout navigates once and stores only the purchased cart selection',async()=>{
 const ui=harness();await ui.open(true);const first=ui.element('checkout-form').emit('submit');
 await ui.element('checkout-form').emit('submit');
 ui.pending[0].resolve({ok:true,json:async()=>({url:'https://checkout.stripe.com/c/pay/cs_test_fixture'})});await first;
 assert.equal(ui.requests.length,1);assert.deepEqual(ui.redirects,['https://checkout.stripe.com/c/pay/cs_test_fixture']);
 assert.deepEqual([...ui.storage],[['jdg-checkout-cart','[{"material":0,"tons":22}]']]);
 assert.equal(ui.busy(),true);
});
