"""Build-time only. Install CoolProp 8.0.0 and numpy, then run this script.
Source EOS references: https://coolprop.org/fluid_properties/fluids/index.html
All stored pressures kPa absolute, enthalpies kJ/kg. No runtime dependency.
"""
import json, math
from pathlib import Path
import CoolProp.CoolProp as CP
COEFF={'R134a':[2.087e-6,.00089072,.14797,10.616,191.46],'R290':[1.4626e-6,.00074114,.16485,14.499,373.11],'R32':[7.1215e-6,.0014878,.31693,26.107,711.64]}
def poly(c,t):
 p=0
 for v in c:p=p*t+v
 return p
result={'source':'CoolProp 8.0.0 HEOS; IIR enthalpy reference','pressureUnit':'kPa absolute','enthalpyUnit':'kJ/kg','step':0.5,'fluids':{}}
report={}
for r,fluid in [('R134a','R134a'),('R290','Propane'),('R32','R32')]:
 CP.set_reference_state(fluid,'IIR')
 c=COEFF[r];samples=[];dome=[]
 def h(p,t):return round(CP.PropsSI('Hmass','P',p*1000,'T',t+273.15,fluid)/1000,6)
 def state(p,t):return [h(p,t),round(p,6)]
 for i in range(111):
  t=i/2;pc=poly(c,t+15)+101.325;pe=poly(c,t-15)+101.325;ps=poly(c,t-20)+101.325
  samples.append({'ambient':t,'suction':state(ps,t-5),'discharge':state(pc,t+45),'condenserOutlet':state(pc,t+10),'receiverOutlet':state(pc,t+9.9),'evaporatorOutlet':state(pe,t-10),'evaporatorPressure':round(pe,6)})
 critical=CP.PropsSI('Tcrit',fluid)-273.15
 for i in range(161):
  t=-30+(min(critical-.02,100)+30)*i/160
  p=CP.PropsSI('P','T',t+273.15,'Q',0,fluid)/1000
  dome.append([round(CP.PropsSI('Hmass','T',t+273.15,'Q',0,fluid)/1000,5),round(p,5),round(CP.PropsSI('Hmass','T',t+273.15,'Q',1,fluid)/1000,5)])
 errors=[]
 for i in range(181):
  t=-20+i/2;reference=CP.PropsSI('P','T',t+273.15,'Q',1,fluid)/1000-101.325
  errors.append((abs(poly(c,t)-reference),t))
 report[r]={'maxAbsoluteErrorKPa':max(errors)[0],'temperatureAtMaxErrorC':max(errors)[1],'rmsErrorKPa':math.sqrt(sum(e*e for e,t in errors)/len(errors)),'samples':len(errors)}
 result['fluids'][r]={'dome':dome,'samples':samples}
Path('lib/properties.json').write_text(json.dumps(result,separators=(',',':')))
Path('tests/property-audit.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
