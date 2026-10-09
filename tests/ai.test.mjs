import {Readable} from 'node:stream';
import test from 'node:test';
import assert from 'node:assert/strict';
import {aiConnector} from '../server/ai.mjs';

test('AI connector requests the selected supported language and safely falls back to English',async()=>{
 const originalFetch=globalThis.fetch;const prompts=[];
 globalThis.fetch=async(_,options)=>{const body=JSON.parse(options.body);prompts.push(body.messages);return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summary:'A verified test response',actions:['Check local harvests']})}}]})};};
 try{
  const middleware=aiConnector({AI_API_KEY:'test-only',AI_API_URL:'https://test.invalid',AI_MODEL:'test-model'});
  for(const [language,expected] of [['tet','Tetum'],['ms','Malay'],['not-a-language','English']]){
   const req=Readable.from([Buffer.from(JSON.stringify({country:'Southeast Asia',year:2030,scenario:'regional_forecast',language,stress:0,risk:{level:'low',change:-0.33,decline:0.33,supply:282},climate:{temperature:999,rain:999},climateSelection:{countryCode:'IDN',period:'2024-02'}}))]);req.url='/api/analyze';req.method='POST';
   const res={statusCode:0,setHeader(){},end(text){this.body=JSON.parse(text)}};
   await middleware(req,res,()=>assert.fail('The analysis route should handle the request'));
   assert.equal(res.statusCode,200);assert.ok(prompts.at(-1)[0].content.includes(`Respond in ${expected}`));assert.equal(JSON.parse(prompts.at(-1)[1].content).country,'Southeast Asia');assert.deepEqual(res.body.actions,['Check local harvests']);
   const context=JSON.parse(prompts.at(-1)[1].content);
   assert.equal(context.productionPressure.declineFrom2024Percent,0.33);assert.equal(context.productionPressure.paddyProductionKgPerPerson,282);
   assert.match(context.productionPressure.units,/never fractions/);assert.equal(context.climate.period,'2024-02');
   assert.notEqual(context.climate.temperatureAnomalyC,999);assert.match(context.climate.units.rainfallChangePercent,/percent/);assert.ok(!Object.hasOwn(context.climate,'rain'));
  }
 }finally{globalThis.fetch=originalFetch;}
});
