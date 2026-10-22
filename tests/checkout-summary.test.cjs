'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('checkout summary separates materials from requested-delivery fees and preserves all cart rows',()=>{
 const source=fs.readFileSync('checkout.js','utf8');
 const elements={};
 const element=()=>({children:[],textContent:'',replaceChildren(){this.children=[]},append(...nodes){this.children.push(...nodes)}});
 const context={document:{createElement:element},$:id=>elements[id]||=(element()),checkoutItems:[{material:0,tons:5},{material:0,tons:6}],products:[{name:'ASTM #57 Stone',price:34}],checkoutUsesCart:true,cartDeliveryCount:()=>1,deliveryFor:()=>195,money:n=>'$'+n.toFixed(2)};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function checkoutSummary()'),source.indexOf('\nasync function openCheckout')),context);
 context.checkoutSummary();
 const output=elements['checkout-summary'].children.map(e=>e.textContent).join('\n');
 assert.match(output,/5 tons of ASTM #57 Stone/);assert.match(output,/6 tons of ASTM #57 Stone/);
 assert.match(output,/1 requested delivery/);
 assert.match(output,/\$195\.00 delivery/);assert.match(output,/\$45\.00 fuel/);
 assert.match(output,/\$614\.00/);
 assert.match(output,/JDG.*confirm|review.*before payment/i);
});
