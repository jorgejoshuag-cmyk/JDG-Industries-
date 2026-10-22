'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cartSource=fs.readFileSync(path.join(root,'cart.js'),'utf8');
const products=JSON.parse(html.match(/const products=(\[.*?\]);/s)[1]);
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
function functionSource(source,name){
 const start=source.indexOf('function '+name+'(');if(start===-1)return null;
 const line=source.slice(start).split('\n')[0];
 return line.endsWith('}')?line:source.slice(start,source.indexOf('\n}',start)+2);
}
function environment(){
 const elements=new Map();
 const $=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',hidden:false,disabled:false,checkValidity:()=>true,setAttribute(){}});return elements.get(id)};
 $('calc-material').value='0';$('calc-tons').value='22';$('quote-material').value='0';$('quote-tons').value='22';
 const context=vm.createContext({$,products,money,window:{},quoteContactLines:()=>['Buyer: Test contractor'],cart:[],requestedDeliveries:null});
 for(const name of ['calculate','quoteBody']){const source=functionSource(html,name);assert.ok(source,'Function '+name+' remains available');vm.runInContext(source,context)}
 return {context,$};
}
function cartEnvironment(items,requestedDeliveries){
 const {context,$}=environment();
 context.cart=items;context.requestedDeliveries=requestedDeliveries;
 const fee=cartSource.match(/^const deliveryFor=.*$/m);if(fee)vm.runInContext(fee[0],context);
 for(const name of ['cartDeliveryCount','cartTotals','cartQuoteBody','persistCart']){
  const source=functionSource(cartSource,name);if(source)vm.runInContext(source,context);
 }
 context.quoteContactLines=()=>['Buyer: Test contractor'];
 return {context,$};
}
test('single-load calculator charges equal approved delivery and fuel for half and full trucks',()=>{
 const {context,$}=environment();
 for(const tons of [0.5,11,11.5,22]){
  $('calc-tons').value=String(tons);const result=vm.runInContext('calculate()',context);
  assert.equal(result.delivery,195);assert.equal(result.total,tons*34+240);
  assert.equal($('delivery-cost').textContent,'$195.00');
 }
});
test('single-load quote draft contains $240 delivery/fuel and jobsite surcharge review before payment',()=>{
 const {context,$}=environment();$('quote-tons').value='11';
 const body=vm.runInContext('quoteBody()',context);
 assert.match(body,/Estimated subtotal: \$614\.00/);
 assert.match(body,/delivery \$195\.00, fuel \$45\.00/);
 assert.match(body,/northern Broward/);assert.match(body,/southern Miami-Dade/);
 assert.match(body,/before payment/);
});
test('cart fees follow requested delivery count instead of material row count',()=>{
 const {context}=cartEnvironment([{material:0,tons:4},{material:1,tons:5},{material:8,tons:2}],2);
 const totals=vm.runInContext('cartTotals()',context);
 assert.equal(totals.deliveries,2);assert.equal(totals.delivery,390);assert.equal(totals.fuel,90);
 assert.equal(totals.material,349.5);
});
test('delivery count respects total capacity while defaulting legacy rows to requested loads',()=>{
 for(const [items,requested,expected] of [
  [[{material:0,tons:22},{material:1,tons:22}],1,2],
  [[{material:0,tons:1},{material:1,tons:1}],null,2],
  [[],null,0]
 ]){
  const {context}=cartEnvironment(items,requested);
  assert.equal(vm.runInContext('typeof cartDeliveryCount === "function" ? cartDeliveryCount() : undefined',context),expected);
 }
});
test('cart quote retains every material and quantity alongside requested deliveries and review caveat',()=>{
 const {context}=cartEnvironment([{material:0,tons:4},{material:1,tons:5},{material:8,tons:2}],2);
 const body=vm.runInContext('cartQuoteBody()',context);
 assert.match(body,/4 tons of ASTM #57 Stone/);assert.match(body,/5 tons of ASTM #67 Stone/);assert.match(body,/2 tons of Lawn Screenings/);
 assert.match(body,/Requested deliveries: 2/);assert.match(body,/\$390\.00 delivery \+ \$90\.00 fuel/);
 assert.match(body,/\$829\.50/);assert.match(body,/JDG.*confirm/i);
 assert.match(body,/northern Broward/);assert.match(body,/southern Miami-Dade/);
 assert.match(body,/before payment/);
});
test('persisting a capacity-adjusted request keeps the shown count when quantities later decrease',()=>{
 const {context}=cartEnvironment([{material:0,tons:22},{material:1,tons:22}],1);
 const values=new Map();Object.assign(context,{cartKey:'jdg-load-cart-v1',deliveryCountKey:'jdg-delivery-count-v1',localStorage:{setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}});
 vm.runInContext('persistCart()',context);
 assert.equal(context.requestedDeliveries,2);assert.equal(values.get('jdg-delivery-count-v1'),'2');
 context.cart[1].tons=0.5;context.cart[0].tons=0.5;
 assert.equal(vm.runInContext('cartDeliveryCount()',context),2);
 assert.deepEqual(JSON.parse(values.get('jdg-load-cart-v1')),[{material:0,tons:22},{material:1,tons:22}]);
 context.cart=[];vm.runInContext('persistCart()',context);
 assert.equal(context.requestedDeliveries,null);assert.equal(values.has('jdg-delivery-count-v1'),false);
});
test('public pricing states half/full parity and final delivery review without old approved rates',()=>{
 const delivery=html.match(/<section id="delivery"[^]*?<\/section>/)[0];
 assert.match(delivery,/\$195 \/ delivery/g);assert.match(delivery,/\$45 \/ delivery/);
 assert.doesNotMatch(html,/\$(145|185|25|50)(?:\D|$)/);
 assert.match(html,/id="cart-deliveries"/);assert.match(html,/combining materials.*JDG/i);
});
