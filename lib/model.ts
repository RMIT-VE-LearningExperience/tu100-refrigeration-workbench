/** TU-100 project-brief model v0.1. Pressures are kPa gauge; temperatures °C.
 * Source: TU-100 emulator logic-MTA1. Constants remain uncalibrated. */
export const VALVES = ['HP1','HP2','HP3','HP4','LRI','LRK','LRB','TXV','CTV','ACI','ACO','ACB'] as const;
export type Valve = typeof VALVES[number];
export type ValveState = Record<Valve, boolean>;
export const REFRIGERANTS = ['R134a','R290','R32','R454C'] as const;
export type Refrigerant = typeof REFRIGERANTS[number];
export const SETTINGS = { enableR454C:true, minAmbient:0,maxAmbient:55, atmosphericPressure:101.325 };
export const COEFFICIENTS:Record<Refrigerant,number[]>={R134a:[2.087e-6,.00089072,.14797,10.616,191.46],R290:[1.4626e-6,.00074114,.16485,14.499,373.11],R32:[7.1215e-6,.0014878,.31693,26.107,711.64],R454C:[6.7169e-6,.00092632,.19689,15.337,352.44]};
const bubbleCoefficients=[4.7174e-7,.0010434,.21318,18.288,482.86];
export const polynomial=(coefficients:number[],t:number)=>coefficients.reduce((p,c)=>p*t+c,0);
export function pressure(r:Refrigerant,t:number){if(!REFRIGERANTS.includes(r)||!Number.isFinite(t)||t< -20||t>70)throw new RangeError('Saturation temperature must be between −20 and 70°C.');return polynomial(COEFFICIENTS[r],t);}
export function bubbleTemperature(r:Refrigerant,p:number){const coeff=r==='R454C'?bubbleCoefficients:COEFFICIENTS[r];let lo=-20,hi=70;if(!Number.isFinite(p)||p<polynomial(coeff,lo)||p>polynomial(coeff,hi))throw new RangeError('Pressure is outside the bubble model domain.');for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(polynomial(coeff,mid)>p)hi=mid;else lo=mid;}return (lo+hi)/2;}
export const CONFIGURATIONS = [
 {id:'cool-txv-all',name:'Cooling · TXV · Receiver + accumulator',mode:'Cooling',meter:'TXV',receiver:true,accumulator:true,bits:'100111010110'},
 {id:'heat-txv-all',name:'Heating · TXV · Receiver + accumulator',mode:'Heating',meter:'TXV',receiver:true,accumulator:true,bits:'011011010110'},
 {id:'cool-ctv-ac',name:'Cooling · Capillary · Accumulator',mode:'Cooling',meter:'CTV',receiver:false,accumulator:true,bits:'100100101110'},
 {id:'heat-ctv-ac',name:'Heating · Capillary · Accumulator',mode:'Heating',meter:'CTV',receiver:false,accumulator:true,bits:'011000101110'},
 {id:'cool-txv-lr',name:'Cooling · TXV · Receiver',mode:'Cooling',meter:'TXV',receiver:true,accumulator:false,bits:'100111010001'},
 {id:'heat-txv-lr',name:'Heating · TXV · Receiver',mode:'Heating',meter:'TXV',receiver:true,accumulator:false,bits:'011011010001'},
 {id:'cool-ctv',name:'Cooling · Capillary only',mode:'Cooling',meter:'CTV',receiver:false,accumulator:false,bits:'100100101001'},
 {id:'heat-ctv',name:'Heating · Capillary only',mode:'Heating',meter:'CTV',receiver:false,accumulator:false,bits:'011000101001'},
] as const;
export const statesFromBits=(bits:string):ValveState=>Object.fromEntries(VALVES.map((v,i)=>[v,bits[i]==='1'])) as ValveState;
export const initialValves=()=>statesFromBits(CONFIGURATIONS[0].bits);
export function matchConfiguration(v:ValveState){return CONFIGURATIONS.find(c=>VALVES.every((key,i)=>typeof v[key]==='boolean'&&v[key]===(c.bits[i]==='1')));}
export function nearestConfiguration(v:ValveState){return CONFIGURATIONS.map(c=>({configuration:c,changes:VALVES.filter((key,i)=>v[key]!== (c.bits[i]==='1'))})).sort((a,b)=>a.changes.length-b.changes.length)[0];}
export function simulate(r:Refrigerant,t:number,v:ValveState,running:boolean){
 const config=matchConfiguration(v);if(!Number.isFinite(t)||t<0||t>55)return {status:'range' as const,config,values:null};if(!config)return {status:'invalid' as const,config,values:null};if(!running)return {status:'stopped' as const,config,values:null};
 const Tcond=t+15,Tevap=t-15,Pdis=pressure(r,Tcond),Pevap=pressure(r,Tevap),Psuc=pressure(r,Tevap-5),Tbubble=bubbleTemperature(r,Pdis),Tco=Tbubble-5;
 return {status:'running' as const,config,values:{Tamb:t,Tcond,Tevap,Tbubble,Pdis,Pevap,Psuc,Tdis:Tcond+30,Tco,Tlro:config.receiver?Tco-.1:null,Teo:Tevap+5,Tacco:config.accumulator?Tevap+6:null,Tsuc:Tevap+10,Tcondairo:t+5,Tevapairo:t-5}};
}
export const VALVE_NAMES:Record<Valve,string>={HP1:'Reversing valve 1',HP2:'Reversing valve 2',HP3:'Reversing valve 3',HP4:'Reversing valve 4',LRI:'Receiver inlet',LRK:'Receiver king valve',LRB:'Receiver bypass',TXV:'Thermostatic expansion',CTV:'Capillary tube',ACI:'Accumulator inlet',ACO:'Accumulator outlet',ACB:'Accumulator bypass'};
