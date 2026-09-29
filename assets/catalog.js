/* Public retail catalog verified against JDG's website on 2026-09-29. No supplier costs. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.JDG=factory()})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const products=Object.freeze([
{id:'stone-57',short:'#57',name:'ASTM #57 Stone',category:'stone',cents:3400,description:'Coarse aggregate for drainage, concrete and sitework. Confirm the project gradation.'},
{id:'stone-67',short:'#67',name:'ASTM #67 Stone',category:'stone',cents:3550,description:'Coarse stone for concrete and bedding where your plans call for #67 aggregate.'},
{id:'stone-89',short:'#89',name:'#89 Stone',category:'stone',cents:3450,description:'Smaller coarse aggregate for specified concrete and drainage applications.'},
{id:'ballast',short:'BAL',name:'Ballast',category:'stone',cents:3550,description:'Larger aggregate for projects specifying ballast. Send your material requirements.'},
{id:'concrete-screenings',short:'CS',name:'Concrete Screenings',category:'screenings',cents:3000,description:'Fine screenings for specified concrete and site applications. Gradation on request.'},
{id:'limerock-base',short:'LBR',name:'Limerock Base',category:'base',cents:3000,description:'Limerock material for specified base work. Ask for available testing information.'},
{id:'fill-screenings',short:'FS',name:'Fill Screenings',category:'screenings',cents:2200,description:'Fine aggregate for suitable fill and grading, subject to project specifications.'},
{id:'quarter-stone',short:'¼″',name:'1/4-inch Stone',category:'stone',cents:3600,description:'Small stone for specified aggregate applications. Confirm sizing before ordering.'},
{id:'lawn-screenings',short:'LS',name:'Lawn Screenings',category:'screenings',cents:1800,description:'Screenings for suitable landscaping and grading work. Confirm suitability for your site.'}
].map(Object.freeze));
const money=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
function estimate(lines){
if(!Array.isArray(lines)||!lines.length||lines.length>9)throw Error('Choose at least one material.');
let material=0,delivery=0,fuel=0,tons=0,loads=0;const seen=new Set();
const normalized=lines.map(line=>{const p=products.find(p=>p.id===line.id);
if(!p||seen.has(p.id))throw Error('A material is invalid or duplicated.');seen.add(p.id);
const t=line.tons,l=line.loads;
if(typeof t!=='number'||!Number.isFinite(t)||t<0.5||t>22||!Number.isInteger(t*2))throw Error('Enter 0.5 to 22 tons per load, in half-ton increments.');
if(typeof l!=='number'||!Number.isInteger(l)||l<1||l>10)throw Error('Enter 1 to 10 loads per material.');
const m=Math.round(p.cents*t)*l,d=(t<=11?14500:18500)*l,f=2500*l;
material+=m;delivery+=d;fuel+=f;tons+=t*l;loads+=l;
return {id:p.id,tons:t,loads:l,material:m,delivery:d,fuel:f};});
if(loads>10)throw Error('For more than 10 loads, call JDG for a project quote.');
return {lines:normalized,material,delivery,fuel,subtotal:material+delivery+fuel,tons,loads};
}
return Object.freeze({products,money,estimate,pricingVerified:'2026-09-29'});
});
